---
name: Admin menu visibility
description: Distinzione tra visibilità del link CMS, ruolo utente e autenticazione del pannello
---

La preview telefonica può attribuire il ruolo applicativo necessario a mostrare “Gestione contenuti”, ma il suo token non deve mai autorizzare le API CMS. Il login CMS resta un confine separato.

**Why:** il menu è solo navigazione, non autorizzazione. Confondere sessioni applicative e sessioni CMS trasforma una comodità di login in un bypass completo.

**How to apply:** le sessioni preview e CMS devono avere chiavi/claim incompatibili. I profili standard usano Cognito, mentre la preview firmata è riservata ad admin abilitati e utenti whitelist promossi. Anche i test browser devono rispettare questa distinzione: una risposta preview con ruolo standard non è una sessione valida e porta correttamente al login.