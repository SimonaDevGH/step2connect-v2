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

Preview admin:

- profilo DynamoDB `type=admin`;
- `adminPsw=true`;
- telefono e OTP sulla stessa riga di `admin-users/users.csv` in S3.

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

Schema:

```text
content/draft/{type}/{lang}/{id}.json
content/published/{type}/{lang}/{id}.json
content/archive/{type}/{lang}/{id}_{timestamp}.json
step2connect/img/{type}/{id}/{timestamp}.{ext}
```

Il form CMS gestisce titolo, corpo, meta description, icona, immagine, audio e
video separatamente per ogni lingua. L’upload binario attuale è limitato alle
immagini; audio e video usano URL.

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

Per la documentazione completa, le route e gli script operativi consultare
`README.md`.