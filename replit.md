# Step2Connect v2

PWA mobile-first per lavoratori bangladesi negli stabilimenti Fincantieri in
Italia. L’interfaccia supporta italiano, inglese e bengalese con testo essenziale
e controlli grandi.

## Comandi

```bash
npm install
npm run dev
npm test
npm run build
npm run start
```

Il workflow Replit esegue `npm run dev`, che avvia:

- Vite su porta 5000;
- Express su porta 3001;
- proxy Vite `/api` verso Express.

In produzione Express usa la porta `PORT` o 5000, espone le API e serve `dist/`.

## Architettura

- Frontend: React 18, Vite 5, React Router 6.
- Backend: Express 5 in `server/`.
- Auth utenti: AWS Cognito passwordless con telefono e SMS OTP.
- Profili e ruoli: DynamoDB, tabella predefinita `Step2Connect_Users`.
- CMS: autenticazione email/password separata e JWT firmato con
  `SESSION_SECRET`.
- Contenuti: S3, un JSON per tipo, stato e lingua.
- Lingue: `it`, `en`, `bn`.

Il root package usa ESM. `server/package.json` imposta CommonJS per tutti i file
backend.

## Convenzioni importanti

- Le API interne e i contenuti pubblici usano URL relativi `/api/...`.
- Aggiornare sempre anche README.md quando cambiano le funzionalità: deve essere
  chiaro e dettagliare ogni funzionalità o area della webapp, inclusi i limiti reali.
- Le nuove letture CMS devono usare lo stesso origin. `VITE_API_BASE_URL` resta
  usato dalla sincronizzazione estesa del profilo e come override legacy in
  `PageResolver`.
- Le route CMS richiedono JWT CMS; una sessione preview non è autorizzazione CMS.
- Il telefono del profilo viene sempre dal JWT Cognito verificato.
- I login normali non inviano campi vuoti che possano cancellare dati DynamoDB.
- Media, immagini e icone localizzati preservano anche valori vuoti intenzionali.
- Gli asset runtime appartengono a `public/` o S3. `attached_assets/` è temporanea
  e ignorata da Git.

## Autenticazione telefono

Formati supportati:

- Italia: `+393XXXXXXXXX`
- Bangladesh: `+880 1XXXXXXXXX`

Il `+` iniziale è obbligatorio. Prima di Cognito, il frontend chiama
`/api/users/account-status` per scegliere tra registrazione, login Cognito e
preview amministratore.

Utenti Fincantieri/ELIS con codice personale:

- CSV **privato** separato: `whitelist-users/fincantieri-users.csv`, stesso bucket contenuti, senza ripieghi;
- colonne `phone,accessCode,firstName,lastName,company,enabled,notes`;
- `accessCode` stringa di 6 cifre (preservare zeri iniziali), `enabled` esattamente `true`;
- profilo DynamoDB già registrato; altrimenti registrazione Cognito invariata;
- login e ripristino riusano le route preview e il tipo server `fincantieri_users`;
- durata 30 giorni; revoca alla rivalidazione per rimozione, disabilitazione o cambio codice;
- `type` assente o stringa vuota equivale a `standard` per il codice personale;
- promozione automatica condizionale solo da `standard` o `type` assente/vuoto, mai da `admin` o altri valori;
- nessun link CMS e nessuna autorizzazione CMS; admin preview e login CMS invariati;
- nessun nuovo Secret; occorrono lettura S3 della chiave e lettura/UpdateItem DynamoDB.

Preview admin:

- profilo DynamoDB `type=admin`;
- `adminPsw=true`;
- telefono e OTP sulla stessa riga di `admin-users/users.csv` in S3.

Il CSV admin mantiene `admin-users/users.csv` sia in lettura sia in scrittura,
senza ripieghi, avvisi di migrazione o rinomina.

## Registrazione

Le aziende e i cantieri arrivano da:

```text
content/registration-login/form_registrazione_lista_aziende_cantieri.csv
```

Il backend espone `/api/registration-options` e mantiene una cache di 5 minuti.
Il browser non legge direttamente il CSV privato.

## CMS e S3

Tipi supportati:

- `guides`
- `news`
- `library`
- `pages`
- `site` (`app-images`, configurazione immagini globali per lingua)

Schema:

```text
content/draft/{type}/{lang}/{id}.json
content/published/{type}/{lang}/{id}.json
content/archive/{type}/{lang}/{id}_{timestamp}.json
step2connect/img/{type}/{id}/{id}_{LANG}_{img|audio|video}.{ext}
```

Per i contenuti editoriali i suffissi lingua sono `IT`, `EN`, `BN`. Le immagini
globali `site/app-images` mantengono la chiave storica
`app-images_{slot}_{lang}.{ext}` (bengalese `bd`).

Il form CMS gestisce titolo, corpo, meta description, icona, immagine, audio e
video separatamente per ogni lingua. Gli upload diretti verso S3 sono disponibili
per immagini (5 MB), audio (25 MB) e video (100 MB); gli URL possono anche
essere inseriti manualmente. Dopo l'upload occorre salvare o pubblicare.

Le guide hanno un `sortOrder` globale opzionale: i numeri più bassi vengono
prima nella categoria e i contenuti senza numero restano in fondo. Il record
`guida-al-servizio` usa la categoria principale `guides`, non `documents`.

## Segreti

Non inserire segreti nel repository. Le principali variabili sono:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `SESSION_SECRET`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_USER_POOL_CLIENT_ID`
- `VITE_API_BASE_URL`

Variabili opzionali includono `DYNAMODB_USERS_TABLE`,
`DYNAMODB_PHONE_INDEX`, `DYNAMODB_REGION` e `SES_FROM_EMAIL`.

## Categorie delle guide

Le sole categorie valide sono Documenti e permessi, Salute e pronto soccorso,
Casa e bollette, Scuola e famiglia, Vivere in città. L'utente ha richiesto la
rimozione di Lavoro e busta paga dall'app e dai selettori CMS; non ripristinarla
come categoria vuota o “in arrivo”. La rimozione non cancella dati già salvati.

## Notifiche

Le notifiche sono interne alla webapp, senza push/SMS/email. Il calendario viene
gestito esclusivamente dal server attraverso il CMS; ogni modifica archivia prima
la versione precedente su S3. Le letture sono persistenti nel profilo DynamoDB,
massimo 300 ID, senza creare nuovi profili.

Il calendario allegato comprende 44 notifiche programmate più N-WELCOME:
l'utente ha confermato di includere anche il tipo `welcome` (oltre a
content_engagement e function_engagement), per un totale di 45. Welcome segue
le medesime regole di date, territorio e stato attivo, non un invio push o un
nuovo flusso di login. Non importare automaticamente i dati di test su S3.

## Visibilità sezioni e pagine

Lo stato si cambia dal CMS: il server gestisce `config/sections.json` senza
interventi manuali su S3. La Home non è configurabile. Admin vede tutto;
Fincantieri/ELIS vede anteprima e pubblicato; standard solo pubblicato.
Devono essere visibili sia sezione sia pagina.

L'utente ha confermato l'attivazione immediata dei default: Quiz, Notifiche,
News, Uffici e Libreria Interne; Guide, Analizza documento, Traduttore e Privacy
Pubblicate. Le pagine legacy senza visibility sono pubblicate, ma non superano
una sezione Interna. Il CMS separa le sezioni; Altro conserva Libreria e Pages
e permette di regolare anche Libreria/Privacy.

I filtri richiesti sono nell'interfaccia: le API pubbliche e gli URL dei media
non sono un archivio riservato. Non confondere visibilità con autorizzazione.

Per la documentazione completa, le route e gli script operativi consultare
`README.md`.