---
name: Admin backend architecture
description: Architettura del backend Express e del pannello admin Step2Connect
---

# Admin backend — decisioni architetturali

## Regola principale
Il backend vive in `server/` con `server/package.json: { "type": "commonjs" }` per evitare conflitti con il root `"type": "module"` del progetto React.

**Why:** il root package.json usa ESM (per Vite). Le dipendenze server (express, jwks-rsa, multer) funzionano meglio in CJS senza flag sperimentali.

**How to apply:** tutti i file in `server/` usano `require()`. I file di script come `scripts/migrate-to-s3.mjs` usano `.mjs` e ESM.

## Auth middleware — due sistemi separati
- `server/middleware/auth.js`: verifica JWT Cognito con JWKS-RSA (per gli utenti lavoratori, non più usato per il pannello admin).
- `server/middleware/adminAuth.js`: verifica JWT firmato con `SESSION_SECRET` (per il CMS admin, email+password).
- Le route `/api/admin/content/*` usano `requireAdminJWT` (NON Cognito).
- Le route `/api/admin/auth/*` (login/me) sono pubbliche.

## Gestione utenti admin CMS
- CSV su S3: `admin-users/users.csv` — colonne `email,name,passwordHash`
- Hash: `crypto.scryptSync(password, salt, 64)` → formato `salt:hash` (hex)
- Gestione da riga di comando: `node scripts/manage-admin-users.mjs add|remove|list`
- JWT firmato con `SESSION_SECRET`, scadenza 8 ore, memorizzato in `localStorage('adminToken')`

## Contenuti — tipo "pages"
- Quarto tipo accanto a guides/news/library
- Campi aggiuntivi: `url` (percorso pubblico, obbligatorio per pages), `metaDesc` (per lingua, max 300 car.)
- `<img src alt>` consentito nella sanificazione HTML (solo schemi http/https)
- Route pubblica: `GET /api/content/pages-by-url?url=...&lang=...`
- Frontend catch-all: `PageResolver.jsx` risolve il pathname e mostra il contenuto CMS

## Upload media
- Nuova path: `step2connect/img/{type}/{id}/{timestamp}.{ext}` (prima era `media/`)
- Immagini legacy da attached_assets/ caricate su S3 sotto `step2connect/img/legacy/`

## Routing frontend — separazione admin/app
- `/admin/*` → AdminShell (senza Cognito, solo adminAuth JWT)
- `/*` → AppShell (Cognito)
- `AdminAuthProvider` wrappa tutto in `src/App.jsx`
- Catch-all app: `PageResolver` tenta risoluzione CMS prima di redirect a /home

## Porte
- Dev: Vite 5000, Express API 3001, proxy Vite `/api` → 3001.
- Prod: Express 5000, serve `dist/` statico + gestisce `/api/*`.
