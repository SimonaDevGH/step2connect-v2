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
21. [Mappa delle aree della webapp](#mappa-delle-aree-della-webapp)

## Funzionalità principali

- Login e registrazione passwordless con AWS Cognito e SMS OTP.
- Instradamento automatico tra login e registrazione in base al profilo
  applicativo presente in DynamoDB.
- Validazione dei numeri italiani e bangladesi prima di contattare Cognito o il
  backend.
- Percorso preview dedicato agli amministratori autorizzati.
- Accesso con codice personale per utenti registrati Fincantieri/ELIS nella
  whitelist attiva, senza SMS, con promozione condizionale del ruolo.
- Interfaccia utente in italiano, inglese e bengalese.
- PWA installabile con manifest e service worker.
- Guide pratiche, notizie, libreria, quiz, uffici, notifiche, traduttore e
  analisi documenti.
- Pannello CMS separato con autenticazione email/password.
- Contenuti multilingua con bozze, pubblicazione e archiviazione su AWS S3.
- Immagini, audio e video localizzati per lingua.
- Immagini delle pagine principali configurabili dal CMS e ordinamento delle
  guide per categoria.
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
- Profilo standard o `fincantieri_users` registrato e attivo nella whitelist:
  viene avviata la challenge con codice personale, senza chiamare Cognito.
  Un attributo `type` assente o stringa vuota equivale a `standard`.
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

### Codici personali Fincantieri / ELIS

La whitelist privata è separata dal CSV admin e risiede nello stesso bucket:
`whitelist-users/fincantieri-users.csv`. Il modello senza credenziali è
`infra/whitelist-users.template.csv`. Le colonne richieste sono:

```csv
phone,accessCode,firstName,lastName,company,enabled,notes
```

- `phone` usa la stessa normalizzazione della preview admin.
- `accessCode` è una stringa di **6 cifre**: non convertirla in numero,
  nemmeno tramite Excel, altrimenti gli zeri iniziali si perdono.
- Sono supportati valori tra virgolette, virgole nelle celle e doppi apici
  escapati, BOM e CRLF. I telefoni duplicati sono rifiutati.
- Solo `enabled=true` (anche `"true"`) abilita il codice. Qualunque altro
  valore lo disabilita. Codici con formato non valido non abilitano il flusso.
- Non c'è cache: il file viene riletto per account-status, verifica e ripristino.
- La whitelist non registra nuovi utenti: senza profilo DynamoDB rimane la
  registrazione Cognito attuale.
- Gli admin continuano a usare `adminPsw` e il CSV admin; non possono usare
  il codice della whitelist neppure se il loro telefono compare nei due CSV.
- Al primo codice valido, un aggiornamento DynamoDB condizionale cambia solo
  il ruolo `standard` (anche `type` assente o stringa vuota) in
  `fincantieri_users`, senza sovrascrivere un admin o altri valori.
- La sessione firmata dura **30 giorni**, usa il tipo `fincantieri_users`
  e viene rifiutata al ripristino se la riga sparisce, è disabilitata o il
  codice cambia. La durata admin resta 8 ore.
- La schermata mostra “codice di accesso personale” in IT/EN/BN e non offre
  il pulsante SMS per questo flusso. Il limite tentativi della preview è invariato.
- Nessuna sessione preview autorizza le API CMS, che conservano il login
  email/password e il loro JWT indipendente.

**Permessi e sicurezza:** nessun nuovo Secret. Il backend richiede `s3:GetObject`
sulla sola chiave whitelist (`infra/whitelist-users-iam.yaml`), oltre ai
permessi DynamoDB di lettura e `UpdateItem` già documentati. L'operatore che
carica il CSV necessita anche di `s3:PutObject`. Il CSV contiene credenziali:
deve rimanere **privato**, non va committato né reso pubblico tramite ACL,
bucket policy, distribuzioni o proxy. Un errore S3/IAM blocca il flusso
anziché concedere una sessione o inviare un SMS in fallback.

**Compatibilità pagine:** home, servizi, guide, news, library, quiz, uffici,
notifiche, traduttore, analisi documento, privacy e pagine CMS pubbliche
utilizzano l'utente applicativo oppure API pubbliche, non token Cognito.
LivePerson e WhatsApp restano integrazioni esterne. `GET /api/users/me`,
la sincronizzazione `/users/sync` e `updateMyProfile` (`PATCH /users/me`
del backend esterno) richiedono invece Cognito: non possono usare una sessione
con codice personale. Il login e il ripristino con codice usano il profilo
restituito dalla verifica server e non chiamano queste API.

## Profili e ruoli DynamoDB

La tabella predefinita è `Step2Connect_Users` nella regione `eu-west-2`.

Il profilo viene cercato esclusivamente tramite il telefono presente nel JWT
Cognito verificato. Il client non può scegliere il numero usato da
`GET /api/users/me`.

Se `DYNAMODB_PHONE_INDEX` è configurato viene usata una query sull’indice;
altrimenti il server esegue una scansione paginata filtrata per `phone`.

Gli aggiornamenti manuali dei ruoli sono riservati a un operatore:

```bash
npm run user:role -- promote <telefono>
npm run user:role -- standard <telefono>
npm run user:role -- fincantieri_users <telefono>
```

Il comando aggiorna soltanto un profilo esistente e verifica il risultato.
Il template IAM a privilegio minimo è in
`infra/step2connect-users-iam.yaml`.
L'unica promozione automatica è quella del login con codice personale già
descritto: richiede whitelist attiva e codice valido e non sovrascrive altri ruoli.

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

Il CSV admin conserva il percorso originale `admin-users/users.csv` sia per
le letture (login CMS e preview admin) sia per le scritture (cambio password,
reset e comandi operatore), senza ripieghi né avvisi di migrazione.
La whitelist usa esclusivamente `whitelist-users/fincantieri-users.csv`,
senza ripieghi. Le policy IAM devono consentire lettura/scrittura sul CSV admin
originale e lettura sul CSV whitelist; entrambi i file devono restare privati.

Il reset risponde sempre con successo quando la richiesta è formalmente valida,
anche se l’email non esiste, per evitare enumerazione degli account CMS.

### Tipi di contenuto

- `guides`
- `news`
- `library`
- `pages`
- `site` (record riservato `app-images` per le immagini globali della webApp)

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

Il filtro **Immagini app** in `/admin/content` gestisce inoltre, per ogni lingua:

- hero della home;
- hero principale delle guide;
- hero delle sei categorie guide;
- hero della pagina Analizza documento;
- logo Step2Connect;
- logo Fincantieri nel menu laterale.

Questi asset sono salvati nel record `site/app-images`. Finché un URL non è
pubblicato, la webApp continua a usare il corrispondente file in `public/`.

Per i contenuti di tipo `guides`, il CMS espone il campo **Ordine nella
categoria**: i valori più bassi vengono mostrati per primi, mentre i contenuti
senza numero restano in fondo mantenendo il loro ordine precedente. La guida
introduttiva `guida-al-servizio` appartiene alla categoria principale `guides`
e non viene elencata nelle categorie intermedie.

Per le guide l’URL pubblico è sempre derivato da categoria e ID. Per le pagine
CMS generiche l’URL deve iniziare con `/`.

Titolo, corpo e meta description vengono sanificati. Sono ammessi soltanto tag
HTML controllati, inclusi paragrafi, liste, link, titoli e immagini HTTP/HTTPS.

### Media

- Le immagini possono essere caricate dal form CMS.
- Formati immagine: JPEG, PNG, WebP e GIF.
- Dimensione massima: 5 MB.
- Audio e video sono localizzati per lingua e possono essere caricati come file
  oppure inseriti come URL. Limiti: audio 25 MB e video 100 MB.
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

Le immagini globali usano quindi:

```text
content/draft/site/{lang}/app-images.json
content/published/site/{lang}/app-images.json
```

### Altri oggetti

```text
admin-users/users.csv
whitelist-users/fincantieri-users.csv
content/registration-login/form_registrazione_lista_aziende_cantieri.csv
step2connect/img/{type}/{id}/{id}_{LANG}_{img|audio|video}.{ext}
```

Gli upload dei contenuti editoriali sono separati per italiano (IT), inglese
(EN) e bengalese (BN). Per esempio: `permitRenewal_IT_audio.mp3`,
`permitRenewal_EN_img.jpg`, `permitRenewal_BN_video.mp4`. Nel CMS puoi caricare
direttamente immagini (max 5 MB), audio (max 25 MB) e video (max 100 MB);
poi salva la bozza o pubblica per collegare i file al contenuto.
Le immagini del record globale `site/app-images` mantengono il naming esistente:

```text
step2connect/img/site/app-images/app-images_{slot}_{lang}.{ext}
```

Solo per le immagini globali il suffisso bengalese è `bd`; il codice interno
della lingua resta `bn`.

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
| `POST` | `/api/users/preview-admin/verify` | Pubblica, rate limited | Verifica codice admin o whitelist |
| `GET` | `/api/users/preview-admin/session` | JWT preview | Ripristina e rivalida sessione admin o whitelist |
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
| `POST` | `/api/admin/content/{type}/{id}/media` | Carica immagine, audio o video localizzato |

L'upload usa `multipart/form-data`, campo `file`, e i parametri query
`lang=it|en|bn` e `mediaType=img|audio|video`. `slot` identifica una singola
immagine della configurazione `site`; per `site` sono ammessi solo upload immagine.

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
- Audio e video possono essere caricati nel CMS per ogni lingua oppure inseriti
  tramite URL.
- News e libreria mantengono fallback statici se l’API non risponde.
- Il cambio lingua può mostrare brevemente il contenuto precedente durante un
  nuovo caricamento.
- L’invio email di reset richiede `SES_FROM_EMAIL` configurato e verificato in
  AWS SES.
- Le notifiche push sono ancora dimostrative.
- Quiz, elenco uffici e schede legacy dei servizi usano dati locali, non un CMS
  o un servizio aggiornato in tempo reale.
- Il traduttore apre WhatsApp: non traduce automaticamente il testo nell'app
  e il numero di destinazione nel codice è ancora un segnaposto.
- L'analisi documenti apre il canale WhatsApp, non esegue OCR o analisi automatica.

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

GitHub, workspace e sito pubblicato sono tre stati distinti: aggiornare il
repository non pubblica automaticamente il codice su Replit. I CSV privati su
S3 e i profili DynamoDB sono dati esterni e non fanno parte del commit Git.
Per confermare un aggiornamento live controllare health check, asset serviti
e comportamento delle API interessate; asset frontend uguali non provano che
il backend abbia lo stesso codice.

## Mappa delle aree della webapp

Questa sezione descrive ciò che è implementato, distinguendo contenuti
gestiti dal CMS, dati dimostrativi e integrazioni esterne.

### Accesso, registrazione e profilo

- `/`: form Accedi/Registrati con scelta IT/EN/BN e validazione del telefono.
- Il controllo account distingue utenti registrati e nuovi prima dell'OTP.
- Cognito gestisce SMS e registrazione; nome, cognome, email, azienda e cantiere
  sono sincronizzati dopo l'accesso. Aziende e cantieri provengono dal CSV S3.
- I profili autorizzati alla whitelist usano il codice personale a 6 cifre,
  senza SMS; un `type` assente o `""` è equiparato a `standard` per questo flusso.
- Gli admin hanno un percorso preview separato; il CMS mantiene il proprio login.
- Le sessioni vengono ripristinate con controlli server; il menu CMS è riservato
  agli utenti admin e non è abilitato per il ruolo `fincantieri_users`.

### Home e navigazione

- `/home`: saluto, accesso rapido ai servizi, guide e strumenti.
- Barra inferiore e menu laterale collegano le aree della webapp e il logout.
- Logo e immagini principali hanno configurazioni localizzate nel CMS, con
  asset locali quando non esiste un URL pubblicato per la lingua.

### Guide

- `/guides`: introduzione al servizio e categorie salute, lavoro, scuola,
  documenti, casa/bollette e vita in città.
- `/guides/:category`: elenco della categoria ordinato secondo i valori CMS.
- `/guides/:category/:item` e route dirette: dettaglio con testo CMS pubblicato
  e audio quando disponibile. Metadati e struttura delle categorie sono locali.
- La guida introduttiva resta nella pagina principale, non nelle categorie
  intermedie. I contenuti vengono richiesti nella lingua selezionata.

### Servizi legacy

- `/service/:service`: schede informative locali per salute, lavoro, scuola
  e documenti. Questa pagina non è collegata alla gestione contenuti del CMS.
- La sezione è distinta dalle guide pubblicate: non considerarla un editor
  dinamico né un catalogo aggiornato automaticamente.

### News

- `/news`: elenco delle notizie pubblicate dal CMS nella lingua selezionata,
  con un elenco locale di fallback.
- `/news/:id`: dettaglio CMS con titolo, immagine, corpo e audio se presenti.
  I campi mancanti non vengono generati automaticamente.

### Libreria

- `/library`: elenco per categorie di materiali pubblicati nel CMS, con dati
  locali di fallback.
- `/library/:id`: dettaglio del materiale CMS; l'upload diretto di PDF come
  allegati non è ancora implementato.
- Il CMS consente di gestire testi e URL dei materiali, oltre ai media supportati.

### Quiz

- `/quiz`: domande a scelta multipla in tre lingue, risposta corretta,
  avanzamento, punteggio finale e possibilità di ricominciare.
- Domande e risposte sono locali; non esistono gestione quiz nel CMS o
  salvataggio server dei risultati.

### Cerca uffici

- `/offices`: ricerca per nome, città o indirizzo e filtro per ospedali,
  patronati, comuni e polizia, con collegamenti telefonici.
- L'elenco è locale e dimostrativo, centrato sull'area veneziana; non usa
  geolocalizzazione, mappe o un servizio di ricerca in tempo reale.

### Notifiche

- `/notifications`: elenco dimostrativo con titolo, testo, data e indicatore
  letto/non letto. Non è un sistema push né una casella personale persistente.

### Traduttore e analisi documenti

- `/translator`: inserimento testo e apertura di WhatsApp con messaggio
  precompilato. Il contatto è ancora un segnaposto da configurare.
- `/analyze-document`: apertura del contatto WhatsApp configurato per assistenza
  sui documenti; l'immagine della pagina è personalizzabile dal CMS.
- Nessuna delle due pagine implementa traduzione automatica, upload di documenti
  al backend o analisi AI interna.

### Privacy, pagine generiche e assistenza

- `/privacy`: informativa nell'interfaccia multilingue.
- Le route non riconosciute passano al resolver delle pagine CMS per URL, poi
  al fallback. Il resolver conserva l'override legacy del backend documentato.
- LivePerson è un'integrazione esterna: le disponibilità dell'assistenza
  dipendono dalla sua configurazione, non da un servizio di chat interno.

### CMS amministrativo

- `/admin/login`, recupero/reset password e `/admin/account`: credenziali CMS
  separate, reset via email e modifica password.
- `/admin/content`: riepilogo Pages di guide, news e libreria, filtri e gestione
  bozze/pubblicati/archivio; Pages è una vista riepilogativa, non un tipo separato.
- Editor con testi IT/EN/BN, metadati, immagini, audio e video per lingua,
  ordinamento delle guide e caricamento dei file supportati.
- Salvataggio bozze, pubblicazione, archiviazione/eliminazione e rinomina dei
  contenuti; soltanto i contenuti pubblicati sono disponibili alle API pubbliche.
- Scheda Immagini app: immagini principali, categorie guide, loghi e pagina
  Analizza documento, separati per lingua.
- Le credenziali admin, la whitelist e i ruoli DynamoDB restano gestiti dai
  file privati o dagli strumenti operatore: non esiste un editor whitelist nel CMS.
- I video possono essere gestiti e caricati nel CMS; la presenza del campo
  non garantisce un player video in ogni pagina pubblica.