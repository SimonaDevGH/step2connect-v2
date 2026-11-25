# Migrazione su server B4 (OVH) — Runbook

Questo documento descrive come predisporre il server OVH di B4 per ospitare
Step2Connect v2, partendo dall'ambiente **DEV** e poi **PROD**. Segue le
attività richieste per la migrazione:

| # | Attività | Stato tecnico | Sezione |
|---|---|---|---|
| 1 | Accettare invito repository GitHub | manuale | [1](#1-accesso-al-repository-github) |
| 2 | Preparazione server | script `bootstrap-server.sh` | [2](#2-preparazione-server) |
| 3 | Configurazione ambiente DEV e produzione | script + `.env` per ambiente | [3](#3-ambiente-dev) / [5](#5-ambiente-prod) |
| 4 | Creazione account Replit aziendale | manuale, fuori dal server | [6](#6-replit-e-crm-aws) |
| 5 | Migrazione utenti su CRM AWS | da definire | [6](#6-replit-e-crm-aws) |

## Architettura sul server

```text
Internet ──443──> Nginx (TLS Let's Encrypt, rate limit /api)
                   ├─ dev.step2connect.it ──> 127.0.0.1:5101 ─> container step2connect-dev
                   └─ step2connect.it     ──> 127.0.0.1:5100 ─> container step2connect-prod
                                                      │
                                     Express (API + SPA dist/) ──> AWS (S3, DynamoDB, Cognito, SES)
```

- Una sola immagine Docker (`Dockerfile`), un container per ambiente.
- I container ascoltano solo su `127.0.0.1`: l'unico accesso pubblico è Nginx.
- Container in sola lettura, utente `node` non root, `no-new-privileges`.
- Ogni ambiente ha il proprio `.env`, il proprio checkout Git e le proprie
  immagini (`step2connect:dev-<sha>`, `step2connect:prod-<sha>`).
- I dati restano su AWS: il server non contiene database né file utente.

```text
/opt/step2connect/
  dev/   .env  app/ (clone Git)  .current_tag
  prod/  .env  app/ (clone Git)  .current_tag
```

### Variante: server condiviso con Traefik (befor1)

Il server B4 `befor1` ospita già altri progetti e pubblica i siti con un
container **Traefik** (file provider, rete Docker `web`, resolver `le`).
Su questo server:

- **non** eseguire `bootstrap-server.sh` né `setup-nginx.sh`: Docker è già
  presente, le porte 80/443 sono di Traefik, il firewall e i siti esistenti non
  vanno toccati;
- seguire la convenzione del server: utente `ubuntu`, progetti in
  `/home/ubuntu/stacks/` → base `/home/ubuntu/stacks/step2connect`;
- nel `.env` impostare `TRAEFIK_NETWORK=web`: `deploy.sh` aggiunge
  `deploy/docker-compose.traefik.yml` e il container è raggiungibile da
  Traefik come `step2connect-<env>:5000`;
- creare la rotta copiando `deploy/traefik/step2connect.yml.template` in
  `/home/ubuntu/traefik-dynamic/step2connect-app-<env>.yml` (file nuovo, i file
  `step2connect-dev.yml` / `stack.yml` esistenti servono il WordPress e non
  vanno modificati);
- in GitHub impostare la variable `OVH_DEPLOY_BASE=/home/ubuntu/stacks/step2connect`
  e `OVH_SSH_USER=ubuntu`.

`deploy.sh` ricava la cartella base dalla propria posizione
(`<base>/<env>/app/deploy/scripts/deploy.sh`), quindi funziona sia in
`/opt/step2connect` sia in `/home/ubuntu/stacks/step2connect`.

### Lockfile generato su Replit

Su Replit `npm install` riscrive gli URL `resolved` di `package-lock.json`
verso il registry interno di Replit (`package-firewall.replit.local` /
`.internal`), irraggiungibile dal server B4 e da GitHub Actions. Il
`Dockerfile` e il workflow `deploy-dev.yml` li riportano a
`registry.npmjs.org` prima di `npm ci`, quindi non serve correggere il file a
mano: gli hash di integrità restano invariati.

### Flusso dei branch

| Branch | Ambiente | Deploy |
|---|---|---|
| `develop` | DEV | automatico a ogni push (GitHub Actions `deploy-dev.yml`) |
| `main` | PROD | manuale (`deploy.sh prod main` o un tag) |

Il branch `develop` va creato da `main` la prima volta.

## Prerequisiti da raccogliere

- [ ] IP pubblico del server OVH e accesso SSH con chiave (utente sudo)
- [ ] Sistema operativo: Ubuntu 22.04 o 24.04 LTS (consigliati almeno 2 vCPU / 4 GB RAM)
- [ ] Dominio DEV (proposta: `dev.step2connect.it`), con record DNS `A`/`AAAA` verso il server
- [ ] Email tecnica per i certificati Let's Encrypt
- [ ] Credenziali AWS **dedicate a DEV** (utente IAM separato da PROD, vedi `infra/`)
- [ ] Valori Cognito (User Pool e App Client) per DEV
- [ ] `SESSION_SECRET` nuovo per DEV (`openssl rand -hex 48`)

## 1. Accesso al repository GitHub

1. Accettare l'invito di collaborazione al repository
   `SimonaDevGH/step2connect-v2` (email GitHub o
   <https://github.com/SimonaDevGH/step2connect-v2/invitations>).
2. Il server **non** usa account personali: accede con una *deploy key*
   read-only generata dallo script al passo 2.

## 2. Preparazione server

Collegarsi in SSH con un utente sudo e lanciare lo script di bootstrap
(è sufficiente copiarlo sul server, il repository verrà clonato dopo):

```bash
curl -fsSLO https://raw.githubusercontent.com/SimonaDevGH/step2connect-v2/main/deploy/scripts/bootstrap-server.sh
sudo bash bootstrap-server.sh
```

> Se il repository è privato, copiare lo script con `scp` invece di `curl`.

Lo script:

- aggiorna il sistema e attiva gli aggiornamenti di sicurezza automatici;
- installa Docker Engine + Compose, Nginx, Certbot, UFW, Fail2ban;
- crea uno swap da 2 GB se assente (la build Vite usa memoria);
- crea l'utente `deploy` (gruppo `docker`) e `/opt/step2connect/{dev,prod}`;
- apre solo le porte 22, 80 e 443;
- genera la deploy key GitHub e la stampa a video.

Al termine aggiungere la chiave stampata in GitHub:
**Settings → Deploy keys → Add deploy key**, titolo `ovh-b4-server`,
**senza** "Allow write access".

Hardening SSH consigliato, dopo aver verificato l'accesso con chiave:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
sudo systemctl reload ssh
```

## 3. Ambiente DEV

### 3.1 Codice e variabili

```bash
sudo -iu deploy git clone git@github.com:SimonaDevGH/step2connect-v2.git /opt/step2connect/dev/app
```

```bash
sudo -iu deploy cp /opt/step2connect/dev/app/deploy/env/.env.example /opt/step2connect/dev/.env
```

```bash
sudo -iu deploy chmod 600 /opt/step2connect/dev/.env
```

```bash
sudo -iu deploy nano /opt/step2connect/dev/.env
```

Valori specifici per DEV: `APP_ENV=dev`, `HOST_PORT=5101`,
`ENV_FILE=/opt/step2connect/dev/.env`, `PUBLIC_URL` e `CORS_ALLOWED_ORIGINS`
con il dominio DEV. Le altre variabili sono descritte nel README
(sezione *Configurazione*).

> Consigliato: bucket S3 e tabella DynamoDB separati per DEV, così i test non
> toccano contenuti e profili reali.

### 3.2 Nginx e HTTPS

Con il DNS già puntato al server:

```bash
sudo /opt/step2connect/dev/app/deploy/scripts/setup-nginx.sh dev dev.step2connect.it ops@b4service.it
```

### 3.3 Primo deploy

```bash
sudo -iu deploy /opt/step2connect/dev/app/deploy/scripts/deploy.sh dev main
```

Finché il branch `develop` non esiste si distribuisce `main`. Lo script
costruisce l'immagine, avvia il container, verifica `/api/health` e in caso di
errore torna automaticamente alla versione precedente.

Verifica:

```bash
curl -fsS https://dev.step2connect.it/api/health
```

### 3.4 Deploy automatico da GitHub Actions

1. Creare una coppia di chiavi dedicata alla CI (sul proprio PC):

   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-dev" -f ./gh-actions-dev
   ```

2. Aggiungere `gh-actions-dev.pub` a `/home/deploy/.ssh/authorized_keys` sul server.
3. In GitHub: **Settings → Environments → New environment** `dev`, poi i secret:

   | Secret | Valore |
   |---|---|
   | `OVH_SSH_HOST` | IP o hostname del server |
   | `OVH_SSH_USER` | `deploy` |
   | `OVH_SSH_PORT` | `22` (o porta personalizzata) |
   | `OVH_SSH_KEY` | contenuto di `gh-actions-dev` (chiave privata) |
   | `OVH_SSH_KNOWN_HOSTS` | output di `ssh-keyscan -t ed25519 <IP-server>` |

4. Creare il branch `develop` da `main` e fare push: il workflow esegue
   test, build e deploy. È anche avviabile a mano da **Actions → Deploy DEV
   (OVH) → Run workflow**, indicando branch, tag o SHA.

Finché `OVH_SSH_HOST` non è configurato il job di deploy viene saltato con un
avviso, senza far fallire la pipeline.

## 4. Operatività

| Operazione | Comando (come utente `deploy`) |
|---|---|
| Stato container | `docker compose -p step2connect-dev ls` / `docker ps` |
| Log applicazione | `docker logs -f --tail=200 step2connect-dev-app-1` |
| Log Nginx | `sudo tail -f /var/log/nginx/step2connect-dev.*.log` |
| Versione in esecuzione | `cat /opt/step2connect/dev/.current_tag` |
| Deploy di un commit | `/opt/step2connect/dev/app/deploy/scripts/deploy.sh dev <sha>` |
| Rollback manuale | `deploy.sh dev <sha-precedente>` |
| Riavvio | `docker restart step2connect-dev-app-1` |

Dopo una modifica al `.env` rieseguire `deploy.sh`: le variabili `VITE_*`
sono incorporate nella build e richiedono una nuova immagine.

## 5. Ambiente PROD

Stessa procedura del DEV con questi valori:

- clone in `/opt/step2connect/prod/app`, `.env` in `/opt/step2connect/prod/.env`;
- `APP_ENV=prod`, `HOST_PORT=5100`, credenziali AWS e `SESSION_SECRET` di produzione;
- Nginx: `setup-nginx.sh prod "step2connect.it www.step2connect.it" <email>`;
- deploy manuale: `deploy.sh prod main` (o un tag di release).

Da fare **solo dopo** la validazione del DEV e concordando la finestra di
cambio DNS, perché `step2connect.it` è il dominio di produzione.

## 6. Replit e CRM AWS

- **Account Replit aziendale**: attività amministrativa. Una volta creato,
  trasferire o re-importare il progetto collegandolo allo stesso repository
  GitHub; Replit resta un ambiente di sviluppo, il server B4 diventa il
  target di deploy.
- **Migrazione utenti su CRM AWS**: richiede specifiche (sistema CRM di
  destinazione, mapping dei campi DynamoDB `Step2Connect_Users`, gestione
  consensi GDPR). Da dettagliare in un'analisi dedicata.
