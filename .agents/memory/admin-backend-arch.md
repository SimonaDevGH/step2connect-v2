---
name: Admin backend architecture
description: Architettura del backend Express e del pannello admin Step2Connect
---

# Admin backend — decisioni architetturali

## Regola principale
Il backend vive in `server/` con `server/package.json: { "type": "commonjs" }` per evitare conflitti con il root `"type": "module"` del progetto React.

**Why:** il root package.json usa ESM (per Vite). Le dipendenze server (express, jwks-rsa, multer) funzionano meglio in CJS senza flag sperimentali.

**How to apply:** tutti i file in `server/` usano `require()`. I file di script come `scripts/migrate-to-s3.mjs` usano `.mjs` e ESM.

## Auth middleware
- `server/middleware/auth.js`: verifica JWT Cognito con JWKS-RSA (caching + rate-limit).
- Usa `COGNITO_USER_POOL_ID` con fallback a `VITE_COGNITO_USER_POOL_ID` (i Replit Secrets hanno il prefisso VITE_).
- `requireAdminGroup` controlla `cognito:groups` include `content-admin`. La vera protezione è server-side; il redirect client-side in `AdminContentPage` è solo UX.

## Porte
- Dev: Vite 5000, Express API 3001, proxy Vite `/api` → 3001.
- Prod: Express 5000, serve `dist/` statico + gestisce `/api/*`.
