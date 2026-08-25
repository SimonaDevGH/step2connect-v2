---
name: Public content origin
description: Regola per le chiamate frontend dei contenuti CMS pubblicati.
---

Le pagine che leggono contenuti CMS pubblicati devono usare URL API relativi allo stesso origin (`/api/...`), sia in sviluppo sia in produzione.

**Why:** La variabile client usata storicamente per l'API punta a un API Gateway precedente e può restituire dati assenti o non aggiornati rispetto agli oggetti pubblicati su S3.

**How to apply:** Per guide, news, library e dettagli di contenuto usare `fetch('/api/content/...')`. In sviluppo Vite inoltra `/api` al server Express; in produzione Express espone frontend e API sullo stesso origin.