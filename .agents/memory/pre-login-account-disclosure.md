---
name: Pre-login account disclosure
description: Decisione esplicita sul compromesso sicurezza/UX del routing telefonico prima dell’OTP.
---

Il prodotto deve controllare il profilo telefonico prima di avviare Cognito e può quindi comunicare al client se il numero va instradato verso registrazione, login standard o preview admin. Il rischio di enumerazione degli account è stato accettato esplicitamente; l’OTP resta sempre obbligatorio e il controllo preliminare non concede una sessione.

**Why:** Il routing e i messaggi pre-login sono un requisito di prodotto per un’app a uso interno. Il proprietario ha scelto di mantenere questa UX dopo essere stato informato che un chiamante anonimo può dedurre l’esistenza e il percorso operativo di un numero.

**How to apply:** Non rimuovere o posticipare automaticamente il controllo pre-login per rendere le risposte indistinguibili. Mantieni però risposta minima, rate limiting e autenticazione OTP obbligatoria; rivaluta la scelta se l’app diventa pubblica o cambia modello di rischio.