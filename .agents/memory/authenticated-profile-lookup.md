---
name: Authenticated profile lookup
description: Regole di sicurezza per leggere il profilo applicativo da DynamoDB
---

# Lookup del profilo autenticato

I dati profilo associati al telefono devono essere letti soltanto sul server, usando il numero presente nel JWT Cognito verificato. Il browser non deve mai fornire un telefono o un ID di profilo per ottenere dati personali.

L’unica eccezione è la verifica della scorciatoia preview: può ricevere il telefono digitato, ma deve restituire esclusivamente un booleano e non dati del profilo.

**Why:** accettare un identificativo dal client per i dati profilo permetterebbe di ottenere il nome di un altro utente. La preview richiede invece una verifica esplicita del numero, ma non è un controllo di accesso.

**How to apply:** per il profilo richiedere sempre un ID token Cognito valido; per la preview esporre solo l’esito `type=admin && adminPsw=true` e trattare qualsiasi errore come non-admin.