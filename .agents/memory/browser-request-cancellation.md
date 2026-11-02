---
name: Browser request cancellation
description: Distinguere richieste browser annullate dalla navigazione da errori reali nei controlli con API simulate.
---

Nei controlli Chromium con API intercettate, una navigazione può annullare le
richieste in attesa della pagina precedente: il tentativo di rispondere genera
`Invalid InterceptionId.` anche quando tutte le verifiche funzionali passano.

**Why:** il browser elimina l'intercettazione quando cambia documento; trattare
questo annullamento come un errore applicativo produce falsi fallimenti intermittenti.

**How to apply:** ignorare esclusivamente questo errore di intercettazione
annullata. Non ignorare errori HTTP, eccezioni della pagina o asserzioni fallite.

Le interazioni CDP non aspettano il rendering React: dopo un click attendere
esplicitamente il controllo o il nuovo stato nel DOM prima dell'interazione
successiva, anziché presumere che la risoluzione di Runtime.evaluate lo garantisca.

**Why:** senza questa attesa i controlli possono risultare intermittentemente
assenti pur essendo funzionanti nell'app, specialmente menu e aggiornamenti asincroni.
