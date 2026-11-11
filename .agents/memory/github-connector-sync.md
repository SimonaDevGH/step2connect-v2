---
name: GitHub sync via connector
description: Come sincronizzare il repository quando il connector GitHub non autentica il comando git push.
---

La connessione GitHub installata in Replit autorizza le richieste REST tramite il
connector, ma non configura automaticamente le credenziali di un normale remote
HTTPS github.com. Se invece il remote esistente usa `github.replit.internal`,
il proxy Git sicuro può già autorizzare fetch e push senza gestire token.

**Why:** Un push HTTPS può fallire con credenziali mancanti anche quando
l'integrazione risulta aggiunta e funzionante. Inoltre, l'output di un singolo
comando shell passato al runtime può essere troncato: per i blob binari una
stringa base64 incompleta produce un file remoto diverso senza necessariamente
far fallire la richiesta GitHub.

**How to apply:** Conservare il remote già configurato e provare prima il normale
push, anche quando una sessione precedente ha richiesto le API. Non sostituire
il proxy interno con github.com. Se manca l'autenticazione, usare
le Git Data API tramite il connector per creare blob, tree, commit e aggiornare
il ref. Suddividere i binari in chunk sotto il limite di output e confrontare lo
SHA del blob caricato e lo SHA del tree remoto con quelli Git locali prima di
allineare il branch locale.