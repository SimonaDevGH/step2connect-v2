---
name: Dev workflow
description: Come gira il progetto Step2Connect in sviluppo e produzione
---

# Workflow di sviluppo

## Dev (npm run dev)
`concurrently` lancia in parallelo:
1. `vite --host 0.0.0.0 --port 5000` — frontend React
2. `node server/index.js` — API Express su porta 3001

Il file `vite.config.js` ha il proxy:
```js
proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
```

**Why:** un solo workflow Replit, un solo `npm run dev` avvia tutto.

## Produzione
`npm run start` → `NODE_ENV=production node server/index.js`
Express serve `dist/` (built da Vite) e gestisce `/api/*`.
Richiede passaggio da deployment static ad autoscale in Replit.

## Push GitHub
Il callback `gitPush` non è disponibile in CodeExecution in questo ambiente — il commit funziona ma il push deve essere fatto manualmente o tramite Replit Git UI.
