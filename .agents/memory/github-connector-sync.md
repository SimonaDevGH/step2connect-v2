---
name: GitHub sync via connector
description: Come sincronizzare il repository quando il connector GitHub non autentica il comando git push.
---

La connessione GitHub installata in Replit autorizza le richieste REST tramite il
connector, ma non configura automaticamente le credenziali del remote HTTPS per
il comando `git push`.

**Why:** Un push HTTPS può fallire con credenziali mancanti anche quando
l'integrazione risulta aggiunta e funzionante. Inoltre, l'output di un singolo
comando shell passato al runtime può essere troncato: per i blob binari una
stringa base64 incompleta produce un file remoto diverso senza necessariamente
far fallire la richiesta GitHub.

**How to apply:** Provare prima il normale push. Se manca l'autenticazione, usare
le Git Data API tramite il connector per creare blob, tree, commit e aggiornare
il ref. Suddividere i binari in chunk sotto il limite di output e confrontare lo
SHA del blob caricato e lo SHA del tree remoto con quelli Git locali prima di
allineare il branch locale.