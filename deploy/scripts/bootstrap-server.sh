#!/usr/bin/env bash
# Preparazione una-tantum del server OVH (B4) per Step2Connect.
# Testato per Ubuntu 22.04 / 24.04. Eseguire come root:
#   sudo bash deploy/scripts/bootstrap-server.sh
#
# Idempotente: può essere rieseguito. Non modifica la configurazione SSH
# (per non rischiare di chiudere fuori l'amministratore): le raccomandazioni
# di hardening SSH sono stampate alla fine.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
BASE_DIR="${BASE_DIR:-/opt/step2connect}"
REPO_SSH_URL="${REPO_SSH_URL:-git@github.com:SimonaDevGH/step2connect-v2.git}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Eseguire come root (sudo)." >&2; exit 1; }
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || echo "ATTENZIONE: script pensato per Ubuntu, rilevato ${ID:-?}."

log "Aggiornamento pacchetti di sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban nginx \
  certbot python3-certbot-nginx unattended-upgrades jq

log "Aggiornamenti di sicurezza automatici"
dpkg-reconfigure -f noninteractive unattended-upgrades

log "Docker Engine + Compose plugin (repository ufficiale Docker)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "Swap (${SWAP_SIZE}) per la build Vite su VPS piccole"
if ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Utente applicativo '${DEPLOY_USER}'"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "Step2Connect deploy" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
touch "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"

log "Chiave SSH read-only per GitHub (deploy key)"
KEY="$DEPLOY_HOME/.ssh/github_deploy"
if [[ ! -f "$KEY" ]]; then
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N "" -C "step2connect-ovh-deploy" -f "$KEY"
fi
if ! grep -q 'Host github.com' "$DEPLOY_HOME/.ssh/config" 2>/dev/null; then
  cat >> "$DEPLOY_HOME/.ssh/config" <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
EOF
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/config"
chmod 600 "$DEPLOY_HOME/.ssh/config"
sudo -u "$DEPLOY_USER" sh -c "ssh-keyscan -t ed25519 github.com >> '$DEPLOY_HOME/.ssh/known_hosts' 2>/dev/null; sort -u -o '$DEPLOY_HOME/.ssh/known_hosts' '$DEPLOY_HOME/.ssh/known_hosts'"

log "Directory ambienti in ${BASE_DIR}"
for env in dev prod; do
  install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BASE_DIR/$env"
done

log "Firewall (UFW): SSH + HTTP/HTTPS"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

log "Fail2ban (protezione SSH)"
cat > /etc/fail2ban/jail.d/step2connect.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

log "Nginx"
rm -f /etc/nginx/sites-enabled/default
systemctl enable --now nginx

cat <<EOF

============================================================================
 Server pronto. Passi successivi (vedi docs/deploy-ovh.md):

 1. Aggiungere questa DEPLOY KEY (read-only) al repository GitHub
    Settings → Deploy keys → Add deploy key (NON spuntare "Allow write"):

$(cat "$KEY.pub")

 2. Clonare il codice per ogni ambiente (come utente ${DEPLOY_USER}):
      sudo -iu ${DEPLOY_USER} git clone ${REPO_SSH_URL} ${BASE_DIR}/dev/app

 3. Creare ${BASE_DIR}/dev/.env da deploy/env/.env.example (chmod 600).

 4. Configurare Nginx + TLS:
      sudo ${BASE_DIR}/dev/app/deploy/scripts/setup-nginx.sh dev dev.step2connect.it admin@example.com

 5. Primo deploy:
      sudo -iu ${DEPLOY_USER} ${BASE_DIR}/dev/app/deploy/scripts/deploy.sh dev main

 Hardening SSH consigliato (dopo aver verificato l'accesso con chiave):
   PasswordAuthentication no, PermitRootLogin prohibit-password
   in /etc/ssh/sshd_config.d/99-hardening.conf, poi: systemctl reload ssh
============================================================================
EOF
