---
name: Migrazione legacy WordPress
description: Ambito approvato della migrazione via link e regole per gli accessi dedicati
---

Gli utenti WordPress legacy sono registrati con email, senza telefono. Lo step 1 usa un registro CSV privato su S3 e non aggiunge campi legacy al CRM v2, hash dei codici o un CRM separato.

**Why:** l'utente ha esplicitamente sostituito eventuali versioni precedenti dello step 1 con questo perimetro.

**How to apply:** non introdurre consenso privacy legacy, controllo email nella registrazione standard, campagna email, modifica profilo/numero o archiviazione temporizzata come parte di questo step.

Il percorso legacy sceglie esplicitamente registrazione o login SMS e conserva i dati per il sync. Gli accessi dedicati preview/admin o whitelist rilevati dal routing vanno rimandati alla login standard, senza forzare SMS. Non convertire profili DynamoDB privi di account Cognito.

**Why:** l'utente ha precisato che i numeri interni non sono utenti legacy reali e il login ordinario non deve cambiare.

**How to apply:** una migrazione si chiude soltanto dopo verifica SMS e sincronizzazione del profilo verificabilmente riuscita. Errori di sync o chiusura non impediscono l'accesso; non chiudere il link dopo un sync fallito.
