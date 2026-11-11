#!/usr/bin/env bash
# Configura il virtual host Nginx (e opzionalmente il certificato TLS) per un
# ambiente Step2Connect.
#   sudo deploy/scripts/setup-nginx.sh <dev|prod> "<dominio> [altri domini]" [email-certbot]
# Esempi:
#   sudo deploy/scripts/setup-nginx.sh dev dev.step2connect.it ops@b4service.it
#   sudo deploy/scripts/setup-nginx.sh prod "step2connect.it www.step2connect.it" ops@b4service.it
set -euo pipefail

APP_ENV="${1:?ambiente richiesto: dev|prod}"
SERVER_NAMES="${2:?dominio richiesto}"
CERT_EMAIL="${3:-}"
BASE_DIR="${BASE_DIR:-/opt/step2connect}"

[[ "$APP_ENV" =~ ^(dev|prod)$ ]] || { echo "Ambiente non valido: $APP_ENV" >&2; exit 1; }
[[ $EUID -eq 0 ]] || { echo "Eseguire come root (sudo)." >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SRC="$SCRIPT_DIR/../nginx"
ENV_FILE="$BASE_DIR/$APP_ENV/.env"

[[ -f "$ENV_FILE" ]] || { echo "Manca $ENV_FILE (creare da deploy/env/.env.example)." >&2; exit 1; }
HOST_PORT="$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '[:space:]"')"
[[ "$HOST_PORT" =~ ^[0-9]+$ ]] || { echo "HOST_PORT non valido in $ENV_FILE" >&2; exit 1; }

install -m 644 "$NGINX_SRC/step2connect-proxy.conf" /etc/nginx/snippets/step2connect-proxy.conf

SITE="/etc/nginx/sites-available/step2connect-$APP_ENV.conf"
sed -e "s/__SERVER_NAME__/$SERVER_NAMES/g" \
    -e "s/__HOST_PORT__/$HOST_PORT/g" \
    -e "s/__APP_ENV__/$APP_ENV/g" \
    "$NGINX_SRC/step2connect.conf.template" > "$SITE"
ln -sf "$SITE" "/etc/nginx/sites-enabled/step2connect-$APP_ENV.conf"

nginx -t
systemctl reload nginx
echo "==> Nginx: $SERVER_NAMES -> 127.0.0.1:$HOST_PORT ($APP_ENV)"

if [[ -n "$CERT_EMAIL" ]]; then
  DOMAIN_ARGS=()
  for d in $SERVER_NAMES; do DOMAIN_ARGS+=(-d "$d"); done
  certbot --nginx "${DOMAIN_ARGS[@]}" --non-interactive --agree-tos -m "$CERT_EMAIL" --redirect
  echo "==> TLS attivo, rinnovo automatico gestito dal timer certbot"
else
  echo "==> TLS non configurato: rieseguire con l'email per certbot quando il DNS punta al server"
fi
