---
name: Admin menu visibility
description: Distinzione tra visibilità del link CMS, ruolo utente e autenticazione del pannello
---

La preview telefonica può attribuire il ruolo applicativo necessario a mostrare “Gestione contenuti”, ma il suo token non deve mai autorizzare le API CMS. Il login CMS resta un confine separato.

**Why:** il menu è solo navigazione, non autorizzazione. Confondere sessioni applicative e sessioni CMS trasforma una comodità di login in un bypass completo. Inoltre, risposte diverse prima del codice permettono di enumerare i numeri privilegiati.

**How to apply:** la challenge iniziale deve essere indistinguibile per tutti i numeri validi. Il server decide solo dopo il codice; le sessioni preview e CMS devono avere chiavi/claim incompatibili. Gli standard richiedono l’SMS dalla schermata neutra.