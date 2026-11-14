---
name: Migrazione legacy WordPress
description: Ambito approvato della migrazione via link e regole per gli accessi dedicati
---

Gli utenti WordPress legacy sono registrati con email, senza telefono. Lo step 1 usa un registro CSV privato su S3, senza hash dei codici o un CRM separato. Le aggiunte approvate richiedono consenso privacy e tipo `standard_legacy` nel CRM v2.

**Why:** l'utente ha esplicitamente sostituito eventuali versioni precedenti dello step 1 con questo perimetro.

**How to apply:** il consenso legacy riusa checkbox, testi ed endpoint della registrazione standard. Non introdurre controllo email nella registrazione standard, campagna email, modifica profilo/numero o archiviazione temporizzata come parte di questo step.

Il percorso legacy sceglie esplicitamente registrazione o login SMS e conserva i dati per il sync. Gli accessi dedicati preview/admin o whitelist rilevati dal routing vanno rimandati alla login standard, senza forzare SMS. Non convertire profili DynamoDB privi di account Cognito.

**Why:** l'utente ha precisato che i numeri interni non sono utenti legacy reali e il login ordinario non deve cambiare.

**How to apply:** una migrazione si chiude soltanto dopo verifica SMS, sincronizzazione del profilo verificabilmente riuscita, salvataggio consenso e scrittura backend di `standard_legacy`, in quest'ordine. Qualsiasi fallimento lascia accesso libero ma link attivo. La data consenso è il click, non la verifica SMS; preservare la prima data. `standard_legacy` equivale a standard per visibilità e whitelist e può essere promosso a fincantieri_users. Mai sovrascrivere altri tipi nella chiusura legacy.

Il test end-to-end reale di accesso SMS e chiusura CSV è riuscito.

**Why:** l'utente ha confermato esplicitamente il risultato prima di richiedere le aggiunte.
