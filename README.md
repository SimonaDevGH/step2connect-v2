# Step2Connect v2

PWA mobile-first e trilingue per supportare lavoratori bangladesi negli
stabilimenti Fincantieri in Italia.

L’interfaccia privilegia testo essenziale, icone grandi e percorsi semplici per
utenti con livelli diversi di alfabetizzazione digitale e linguistica. Le lingue
supportate sono:

- italiano (`it`)
- inglese (`en`)
- bengalese (`bn`)

## Indice

1. [Funzionalità principali](#funzionalità-principali)
2. [Stack tecnico](#stack-tecnico)
3. [Architettura](#architettura)
4. [Installazione e avvio](#installazione-e-avvio)
5. [Configurazione](#configurazione)
6. [Autenticazione degli utenti](#autenticazione-degli-utenti)
7. [Profili e ruoli DynamoDB](#profili-e-ruoli-dynamodb)
8. [Opzioni di registrazione da S3](#opzioni-di-registrazione-da-s3)
9. [Pannello CMS](#pannello-cms)
10. [Contenuti e media su S3](#contenuti-e-media-su-s3)
11. [API disponibili](#api-disponibili)
12. [Route frontend](#route-frontend)
13. [Struttura del repository](#struttura-del-repository)
14. [PWA e asset pubblici](#pwa-e-asset-pubblici)
15. [LivePerson e WhatsApp](#liveperson-e-whatsapp)
16. [Test e controlli](#test-e-controlli)
17. [Script operativi](#script-operativi)
18. [Sicurezza](#sicurezza)
19. [Limiti attuali](#limiti-attuali)
20. [Deploy e repository](#deploy-e-repository)

## Funzionalità principali

- Login e registrazione passwordless con AWS Cognito e SMS OTP.
- Instradamento automatico tra login e registrazione in base al profilo
  applicativo presente in DynamoDB.
- Validazione dei numeri italiani e bangladesi prima di contattare Cognito o il
  backend.
- Percorso preview dedicato agli amministratori autorizzati.
- Interfaccia utente in italiano, inglese e bengalese.
- PWA installabile con manifest e service worker.
- Guide pratiche, notizie, libreria, quiz, uffici, notifiche, traduttore e
  analisi documenti.
- Pannello CMS separato con autenticazione email/password.
- Contenuti multilingua con bozze, pubblicazione e archiviazione su AWS S3.
- Immagini, audio e video localizzati per lingua.
- Gestione dei ruoli applicativi tramite comando operatore, senza endpoint HTTP
  di promozione pubblici.
- Integrazione LivePerson e collegamenti WhatsApp.

## Stack tecnico

### Frontend

| Tecnologia | Versione principale | Utilizzo |
|---|---:|---|
| React | 18 | Componenti e stato UI |
| Vite | 5 | Dev server e build |
| React Router | 6 | Routing SPA |
| AWS Amplify | 6 | Cognito, sessione e OTP |
| Lucide React | 0.447 | Icone |
| vite-plugin-pwa | 0.20 | Manifest e service worker |

### Backend

| Tecnologia | Versione principale | Utilizzo |
|---|---:|---|
| Node.js | 20+ | Runtime |
| Express | 5 | API HTTP e static server di produzione |
| AWS SDK v3 | 3.x | S3, DynamoDB e SES |
| jsonwebtoken | 9 | Token CMS e sessioni preview |
| jwks-rsa | 4 | Verifica JWT Cognito |
| Multer | 2 | Upload immagini |
| Zod | 4 | Validazione contenuti CMS |
| sanitize-html | 2 | Sanificazione HTML |

Il package principale usa moduli ESM. Il backend mantiene CommonJS tramite
`server/package.json`, così i file in `server/` usano `require()` mentre gli
script operativi usano `.mjs`.

## Architettura

```text
Browser
  |
  |-- React SPA / PWA
  |     |-- AWS Amplify --> AWS Cognito (telefono + SMS OTP)
  |     `-- /api/* ------> Express
  |
Express
  |-- verifica JWT Cognito tramite JWKS
  |-- sessioni preview e CMS tramite SESSION_SECRET
  |-- profili e ruoli --------------------------> DynamoDB
  |-- contenuti, utenti CMS e CSV registrazione -> S3
  |-- email reset password ---------------------> SES
  `-- in produzione serve anche dist/
```

### Sviluppo

`npm run dev` avvia due processi tramite `concurrently`:

- Vite su porta `5000`
- Express su porta `3001`

Vite inoltra tutte le richieste `/api` a Express. Le chiamate frontend alle API
interne devono quindi usare URL relativi, ad esempio `/api/content`.

### Produzione

`npm run start` avvia Express in modalità produzione. Express:

- ascolta su `PORT`, con fallback `5000`;
- espone tutte le route `/api/*`;
- serve la build Vite da `dist/`;
- restituisce `dist/index.html` per le route SPA.

## Installazione e avvio

### Requisiti

- Node.js 20 o superiore
- npm
- configurazione AWS/Cognito disponibile nei Replit Secrets

### Comandi

```bash
npm install
npm run dev
```

Altri script:

```bash
npm test             # suite Node
npm run build        # build Vite in dist/
npm run preview      # anteprima della build Vite
npm run start        # server di produzione
npm run migrate      # migrazione iniziale dei contenuti su S3
npm run user:role -- promote +393123456789
npm run user:role -- standard +393123456789
```

Il workflow Replit configurato usa:

```bash
npm run dev
```

## Configurazione

Non inserire valori reali nel repository. Tutte le credenziali devono essere
gestite tramite Replit Secrets.

### Variabili richieste

| Variabile | Utilizzo |
|---|---|
| `AWS_ACCESS_KEY_ID` | Accesso server ad AWS |
| `AWS_SECRET_ACCESS_KEY` | Accesso server ad AWS |
| `AWS_REGION` | Regione AWS, fallback `eu-west-2` |
| `S3_BUCKET_NAME` | Bucket contenuti, CSV e utenti CMS |
| `SESSION_SECRET` | Firma JWT CMS, challenge e sessioni preview |
| `VITE_COGNITO_USER_POOL_ID` | User Pool Cognito frontend e verifica backend |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | App Client Cognito |
| `VITE_API_BASE_URL` | Backend esterno usato per la sincronizzazione completa del profilo; `PageResolver` conserva anche un override legacy quando è valorizzato |

### Variabili opzionali

| Variabile | Default | Utilizzo |
|---|---|---|
| `PORT` | `5000` | Porta Express in produzione |
| `API_PORT` | `3001` | Porta Express in sviluppo |
| `COGNITO_REGION` | `AWS_REGION` | Regione Cognito lato server |
| `COGNITO_USER_POOL_ID` | valore `VITE_*` | Override server del User Pool |
| `COGNITO_USER_POOL_CLIENT_ID` | valore `VITE_*` | Override server del Client ID |
| `DYNAMODB_REGION` | `AWS_REGION` | Regione tabella profili |
| `DYNAMODB_USERS_TABLE` | `Step2Connect_Users` | Nome tabella profili |
| `DYNAMODB_PHONE_INDEX` | vuoto | Indice DynamoDB con partition key `phone` |
| `SES_FROM_EMAIL` | nessuno | Mittente verificato SES per reset password |

`VITE_*` viene incorporato nella build client: non usare mai questo prefisso per
segreti.

## Autenticazione degli utenti

### Formati telefonici supportati

Il client valida il numero prima di effettuare qualsiasi chiamata a DynamoDB o
Cognito:

- Italia: `+393XXXXXXXXX`
- Bangladesh: `+880 1XXXXXXXXX`

Il carattere `+` iniziale è obbligatorio. Spazi, parentesi, punti e trattini
comuni vengono ignorati durante il controllo, ma il numero normalizzato deve
rispettare uno dei due formati.

### Controllo account pre-login

Entrambi i form chiamano `POST /api/users/account-status`.

- Numero non presente durante **Accedi**: il form passa a **Registrati**.
- Numero già presente durante **Registrati**: il form passa ad **Accedi**.
- Profilo standard: viene avviato Cognito.
- Profilo admin con preview abilitata: viene avviata la challenge preview.
- Errore o timeout DynamoDB: il flusso si blocca in modalità fail-closed.

La route restituisce solo `exists` e il tipo minimo di flusso richiesto
dall’interfaccia. È limitata per IP. La distinzione pre-login è una scelta di
prodotto intenzionale per questa applicazione interna; l’OTP resta obbligatorio.

### Registrazione Cognito

1. Il client invia a Cognito esclusivamente `phone_number`.
2. Cognito richiede comunque una password tecnica: viene generato un UUID con il
   suffisso `Xz9!` per rispettare la policy.
3. `confirmSignUp` verifica il codice ricevuto via SMS.
4. `autoSignIn` completa la sessione.
5. Nome, cognome, email, azienda e cantiere vengono inviati al backend profili
   dopo il login.

I login normali non inviano campi vuoti al backend: in questo modo non cancellano
dati già presenti nel profilo DynamoDB.

### Login Cognito

Il login usa il flusso Amplify `USER_AUTH` con challenge preferita `SMS_OTP`.
Dopo `confirmSignIn`, il client recupera attributi e ID token. La lettura del
profilo DynamoDB avviene senza bloccare il primo render.

### Preview amministratore

Un profilo è idoneo alla preview solo quando DynamoDB contiene:

```text
type = admin
adminPsw = true
```

Il numero deve inoltre corrispondere alla stessa riga del codice `adminOTP` nel
CSV `admin-users/users.csv` su S3.

Il server:

1. rilascia una challenge firmata di 5 minuti;
2. verifica telefono, OTP, profilo DynamoDB e riga CSV;
3. rilascia una sessione preview firmata di 8 ore;
4. ricontrolla ruolo e versione della credenziale quando ripristina la sessione.

Una sessione preview può mostrare l’interfaccia principale con ruolo admin, ma
non autorizza le API del CMS. Il CMS richiede sempre il proprio JWT.

## Profili e ruoli DynamoDB

La tabella predefinita è `Step2Connect_Users` nella regione `eu-west-2`.

Il profilo viene cercato esclusivamente tramite il telefono presente nel JWT
Cognito verificato. Il client non può scegliere il numero usato da
`GET /api/users/me`.

Se `DYNAMODB_PHONE_INDEX` è configurato viene usata una query sull’indice;
altrimenti il server esegue una scansione paginata filtrata per `phone`.

I ruoli possono essere modificati solo da un operatore:

```bash
npm run user:role -- promote <telefono>
npm run user:role -- standard <telefono>
```

Il comando aggiorna soltanto un profilo esistente e verifica il risultato.
Il template IAM a privilegio minimo è in
`infra/step2connect-users-iam.yaml`.

## Opzioni di registrazione da S3

Le liste **Azienda** e **Cantiere** non sono hardcoded nel frontend.

Il server legge:

```text
content/registration-login/form_registrazione_lista_aziende_cantieri.csv
```

Caratteristiche del parser:

- delimitatore `;` o `,` rilevato automaticamente;
- BOM UTF-8;
- CRLF e LF;
- celle tra virgolette;
- doppi apici escapati;
- rimozione di valori vuoti e duplicati;
- colonne obbligatorie `Azienda` e `Cantieri`;
- cache server di 5 minuti.

Il browser riceve solo gli array elaborati da
`GET /api/registration-options`; non accede direttamente al file S3 privato.

## Pannello CMS

Il CMS è disponibile sotto `/admin/*` ed è separato dall’autenticazione Cognito.

### Autenticazione CMS

- login email/password;
- utenti nel file S3 `admin-users/users.csv`;
- password con scrypt nel formato `salt:hash`;
- JWT firmato con `SESSION_SECRET`;
- durata sessione: 8 ore;
- cambio password;
- reset password con token monouso valido un’ora;
- invio email tramite AWS SES.

Il reset risponde sempre con successo quando la richiesta è formalmente valida,
anche se l’email non esiste, per evitare enumerazione degli account CMS.

### Tipi di contenuto

- `guides`
- `news`
- `library`
- `pages`

La scheda riepilogativa `all` dell’admin combina guide, news e library; non è un
tipo di contenuto S3 separato.

### Campi

Metadati condivisi:

- `id`
- `type`
- `category`
- `url`

Campi localizzati per `it`, `en` e `bn`:

- `title`
- `body`
- `metaDesc`
- `emoji`
- `imageUrl`
- `audioUrl`
- `videoUrl`

Per le guide l’URL pubblico è sempre derivato da categoria e ID. Per le pagine
CMS generiche l’URL deve iniziare con `/`.

Titolo, corpo e meta description vengono sanificati. Sono ammessi soltanto tag
HTML controllati, inclusi paragrafi, liste, link, titoli e immagini HTTP/HTTPS.

### Media

- Le immagini possono essere caricate dal form CMS.
- Formati immagine: JPEG, PNG, WebP e GIF.
- Dimensione massima: 5 MB.
- Audio e video sono localizzati per lingua e attualmente vengono inseriti come
  URL.
- Un valore vuoto inviato intenzionalmente per una lingua non viene sostituito
  dal media di un’altra lingua.

## Contenuti e media su S3

### Chiavi dei contenuti

```text
content/
  draft/{type}/{lang}/{id}.json
  published/{type}/{lang}/{id}.json
  archive/{type}/{lang}/{id}_{timestamp}.json
```

Ogni lingua usa un file separato.

### Altri oggetti

```text
admin-users/users.csv
content/registration-login/form_registrazione_lista_aziende_cantieri.csv
step2connect/img/{type}/{id}/{timestamp}.{ext}
```

### Ciclo di vita

1. **Salva bozza** scrive i tre file localizzati in `draft`.
2. **Pubblica** copia i file disponibili in `published`.
3. Una rinomina crea il nuovo ID e disattiva il vecchio URL dopo la
   pubblicazione.
4. **Elimina** archivia la bozza e rimuove le chiavi attive di bozza e
   pubblicazione.

Le liste e i dettagli pubblici di guide, news e library leggono dallo stesso
origin:

```text
/api/content/...
```

In sviluppo la richiesta passa dal proxy Vite; in produzione raggiunge Express
direttamente. `PageResolver` mantiene per compatibilità un override tramite
`VITE_API_BASE_URL` quando la variabile è valorizzata; le nuove letture CMS non
devono estendere questa dipendenza legacy.

News e libreria conservano dati statici di fallback per mostrare un contenuto
minimo quando l’API non è disponibile.

## API disponibili

### Sistema

| Metodo | Endpoint | Autorizzazione | Descrizione |
|---|---|---|---|
| `GET` | `/api/health` | Pubblica | Health check |

### Utenti

| Metodo | Endpoint | Autorizzazione | Descrizione |
|---|---|---|---|
| `POST` | `/api/users/account-status` | Pubblica, rate limited | Instrada login/registrazione |
| `POST` | `/api/users/preview-admin` | Pubblica, rate limited | Crea challenge preview |
| `POST` | `/api/users/preview-admin/verify` | Pubblica, rate limited | Verifica OTP preview |
| `GET` | `/api/users/preview-admin/session` | JWT preview | Ripristina sessione preview |
| `GET` | `/api/users/me` | JWT Cognito | Legge nome e ruolo applicativo |
| `GET` | `/api/registration-options` | Pubblica | Aziende e cantieri da CSV S3 |

La sincronizzazione estesa del profilo usa il backend configurato in
`VITE_API_BASE_URL`.

### Contenuti pubblici

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/content?type={type}&lang={lang}` | Elenco pubblicato |
| `GET` | `/api/content/pages-by-url?url={path}&lang={lang}` | Pagina CMS per URL |
| `GET` | `/api/content/{type}/{id}?lang={lang}` | Dettaglio pubblicato |

### Autenticazione CMS

| Metodo | Endpoint | Autorizzazione |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Pubblica |
| `GET` | `/api/admin/auth/me` | JWT CMS |
| `POST` | `/api/admin/auth/change-password` | JWT CMS |
| `POST` | `/api/admin/auth/forgot-password` | Pubblica |
| `POST` | `/api/admin/auth/reset-password` | Token reset |

### Contenuti CMS

Tutte le route richiedono JWT CMS:

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/admin/content?type={type}&lang={lang}` | Lista bozze e stato pubblicazione |
| `GET` | `/api/admin/content/{type}/{id}` | Bozza multilingua |
| `PUT` | `/api/admin/content/{type}/{id}` | Crea o aggiorna bozza |
| `POST` | `/api/admin/content/{type}/{id}/publish` | Pubblica |
| `DELETE` | `/api/admin/content/{type}/{id}` | Archivia e rimuove |
| `POST` | `/api/admin/content/{type}/{id}/media` | Carica immagine |

## Route frontend

### App utente

| Route | Pagina |
|---|---|
| `/` | Login oppure redirect all’app |
| `/home` | Home |
| `/service/:service` | Dettaglio servizio |
| `/guides` | Categorie guide |
| `/guides/:category` | Elenco categoria o guida diretta |
| `/guides/:category/:item` | Dettaglio guida |
| `/news` | Notizie |
| `/news/:id` | Dettaglio notizia CMS |
| `/library` | Libreria |
| `/library/:id` | Dettaglio elemento libreria |
| `/quiz` | Quiz |
| `/offices` | Ricerca uffici |
| `/notifications` | Notifiche |
| `/translator` | Traduttore WhatsApp |
| `/analyze-document` | Analisi documento via WhatsApp |
| `/privacy` | Privacy |
| `/*` | Risoluzione pagina CMS, poi fallback |

Le route applicative richiedono una sessione Cognito o preview valida.

### CMS

| Route | Pagina |
|---|---|
| `/admin/login` | Login CMS |
| `/admin/forgot-password` | Richiesta reset |
| `/admin/reset-password` | Impostazione nuova password |
| `/admin/content` | Gestione contenuti |
| `/admin/account` | Cambio password |

## Struttura del repository

```text
public/                         asset runtime e icone PWA
src/
  components/                   navigazione e LivePerson
  context/                      autenticazione, CMS e lingua
  data/                         metadati statici delle guide
  i18n/                         traduzioni IT / EN / BN
  lib/                          Cognito, API, ruoli e validazioni
  pages/                        pagine utente
  pages/admin/                  pagine CMS
  App.jsx                       router e shell
  main.jsx                      bootstrap React
  index.css                     stile mobile-first
server/
  lib/                          S3, DynamoDB, CSV, email e validazione
  middleware/                   JWT Cognito e CMS
  routes/                       API Express
  index.js                      entrypoint server
scripts/                        strumenti operativi e migrazioni
infra/                          template IAM
test/                           test Node
```

La cartella `attached_assets/` contiene caricamenti temporanei della chat Replit
e non fa parte del runtime. È ignorata da Git; gli asset necessari all’app devono
essere copiati in `public/` oppure caricati su S3.

## PWA e asset pubblici

Il manifest è generato da `vite-plugin-pwa`.

- nome: Step2Connect
- display: `standalone`
- orientamento: `portrait`
- colore tema: `#0A1E3A`
- icone: `public/icon-192.png` e `public/icon-512.png`
- service worker: aggiornamento automatico

Logo, hero e immagini statiche usate dal frontend sono conservati in `public/`.
La build `dist/` è generata e non viene tracciata da Git.

## LivePerson e WhatsApp

Il tag LivePerson viene caricato da `index.html`. Il componente
`LivePersonBubble` notifica i cambi di route con `lpTag.newPage()`.

Il widget dipende dalla configurazione dell’engagement nella console LivePerson;
la sua assenza in staging non indica necessariamente un errore dell’app.

Le pagine Traduttore e Analizza documento aprono conversazioni WhatsApp con testo
precompilato. I numeri di destinazione sono configurati nei rispettivi componenti.

## Test e controlli

Eseguire:

```bash
npm test
npm run build
```

La suite copre:

- media localizzati e compatibilità con contenuti legacy;
- ruoli admin e visibilità del menu CMS;
- sicurezza delle sessioni preview;
- routing account pre-login e rate limiting;
- preservazione dei profili durante il login;
- parsing del CSV di registrazione;
- validazione dei numeri italiani e bangladesi.

Dopo modifiche a codice, dipendenze o comandi di avvio, riavviare anche il
workflow Replit e controllare log e preview.

## Script operativi

### Gestione utenti CMS

```bash
node scripts/manage-admin-users.mjs list
node scripts/manage-admin-users.mjs add <email> <nome> <password>
node scripts/manage-admin-users.mjs remove <email>
```

### Ruoli applicativi

```bash
npm run user:role -- promote <telefono>
npm run user:role -- standard <telefono>
```

### Migrazione iniziale S3

```bash
npm run migrate
```

Lo script di migrazione è una procedura una-tantum per inizializzare contenuti
hardcoded nel bucket. Non eseguirlo automaticamente in produzione.

## Sicurezza

- Non committare `.env`, credenziali AWS, token o dati personali.
- Il CMS e la preview amministratore usano token con tipo, issuer e audience
  distinti.
- Una sessione preview non autorizza le API CMS.
- I JWT Cognito vengono verificati tramite JWKS, issuer, audience e `token_use`.
- Le route account e preview sono rate limited in memoria.
- I profili vengono cercati dal telefono verificato nel JWT, non da parametri
  inviati dal browser.
- Le password CMS sono hashate con scrypt e salt casuale.
- L’HTML CMS è validato e sanificato prima del salvataggio.
- Le API pubbliche leggono solo da `content/published`.

## Limiti attuali

- Gli elementi `library` possono mostrare contenuti CMS, ma l’upload diretto di
  file PDF non è ancora disponibile.
- Audio e video supportano URL localizzati; l’upload binario dal CMS non è ancora
  disponibile.
- News e libreria mantengono fallback statici se l’API non risponde.
- Il cambio lingua può mostrare brevemente il contenuto precedente durante un
  nuovo caricamento.
- L’invio email di reset richiede `SES_FROM_EMAIL` configurato e verificato in
  AWS SES.
- Le notifiche push sono ancora dimostrative.

## Deploy e repository

Repository GitHub:

<https://github.com/SimonaDevGH/step2connect-v2>

Applicazione pubblicata:

<https://step-2-connect-v-2.replit.app>

La pubblicazione su Replit usa il comando di produzione:

```bash
npm run start
```

Prima di pubblicare:

1. eseguire test e build;
2. verificare il workflow di sviluppo;
3. controllare che i Secrets richiesti siano disponibili;
4. verificare `/api/health`;
5. pubblicare tramite il flusso Replit Publish.