---
name: Authenticated profile lookup
description: Regole di sicurezza per leggere il profilo applicativo da DynamoDB
---

# Lookup del profilo autenticato

I dati profilo associati al telefono devono essere letti soltanto sul server, usando il numero presente nel JWT Cognito verificato. Il browser non deve mai fornire un telefono o un ID di profilo da cercare.

**Why:** accettare un identificativo dal client permetterebbe di ottenere il nome di un altro utente. Un token firmato ma emesso per un diverso client Cognito non costituisce una sessione valida per l’app.

**How to apply:** richiedere sempre un ID token Cognito con issuer, audience e `token_use` validi; esporre solo i campi necessari alla UI e associare le risposte asincrone alla sessione che le ha iniziate.