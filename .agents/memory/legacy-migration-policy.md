---
name: Migrazione legacy WordPress
description: Ambito approvato della migrazione via link e regole per gli accessi dedicati
---

Gli utenti WordPress legacy sono registrati con email, senza telefono. Lo step 1 usa un registro CSV privato su S3, senza hash dei codici o un CRM separato. Le aggiunte approvate richiedono consenso privacy e tipo `standard_legacy` nel CRM v2.

**Why:** l'utente ha esplicitamente sostituito eventuali versioni precedenti dello step 1 con questo perimetro.

**How to apply:** il consenso legacy riusa checkbox, testi ed endpoint della registrazione standard. Lo step 2 aggiunge l'email obbligatoria in Registrati e il riconoscimento nel CSV prima di Cognito; non introdurre campagna email, modifica profilo/numero o archiviazione temporizzata.

Il controllo email dello step 2 non restituisce mai token o dati CSV al browser. Per una riga attiva invia il link originale del CSV all'email normalizzata della riga tramite SES e risponde solo `legacy_email_sent`; un popup rimanda alla login. Non usare token nello stato del router né banner aggiuntivi. Il link email continua a usare `t`. Un'email già migrata rimanda al login; righe senza link non bloccano la normale registrazione.

**Why:** l'utente ha cambiato esplicitamente decisione per evitare che il solo riconoscimento dell'email esponga il link o i dati personali.

**How to apply:** email unica con IT/EN/BN, link personale non condivisibile, massimo un invio per riga ogni dieci minuti (memoria ammessa), oltre al limite IP. Fallimento SES: 503, nessuna chiamata Cognito. Nei test non inviare email reali.

Il mittente legacy deve provenire esclusivamente da `LEGACY_FROM_EMAIL`, senza vincoli sul dominio e senza ripiegare sul mittente admin. Il reset password admin resta su `SES_FROM_EMAIL`. Se il mittente legacy manca, restituire 503 generico senza Cognito. Il passaggio dal mittente di collaudo a quello definitivo deve richiedere solo un cambio della variabile.

**Why:** l'utente ha rimosso esplicitamente il divieto del dominio di collaudo, per consentire i test prima della verifica SES del dominio definitivo.

Il percorso legacy sceglie esplicitamente registrazione o login SMS e conserva i dati per il sync. Gli accessi dedicati preview/admin o whitelist rilevati dal routing vanno rimandati alla login standard, senza forzare SMS. Non convertire profili DynamoDB privi di account Cognito.

**Why:** l'utente ha precisato che i numeri interni non sono utenti legacy reali e il login ordinario non deve cambiare.

**How to apply:** una migrazione si chiude soltanto dopo verifica SMS, sincronizzazione del profilo verificabilmente riuscita, salvataggio consenso e scrittura backend di `standard_legacy`, in quest'ordine. Qualsiasi fallimento lascia accesso libero ma link attivo. La data consenso è il click, non la verifica SMS; preservare la prima data. `standard_legacy` equivale a standard per visibilità e whitelist e può essere promosso a fincantieri_users. Mai sovrascrivere altri tipi nella chiusura legacy.

Il test end-to-end reale di accesso SMS e chiusura CSV è riuscito.

**Why:** l'utente ha confermato esplicitamente il risultato prima di richiedere le aggiunte.
