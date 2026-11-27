# Step2Connect v2

PWA mobile-first e trilingue per supportare lavoratori bangladesi negli
stabilimenti Fincantieri in Italia.

L’interfaccia privilegia testo essenziale, icone grandi e percorsi semplici per
utenti con livelli diversi di alfabetizzazione digitale e linguistica. Le lingue
supportate sono:

- italiano (`it`)
- inglese (`en`)
- bengalese (`bn`)

## Da dove iniziare

Questo repository contiene **sia la webapp sia il server e il CMS**. Non è solo
una raccolta di schermate: notifiche, quiz, risultati e badge hanno API dedicate.

| Se vuoi… | Leggi |
|---|---|
| Capire cosa fa ogni pagina | [Mappa delle aree della webapp](#mappa-delle-aree-della-webapp) |
| Gestire i contenuti senza programmare | [Guida rapida al CMS](#guida-rapida-al-cms) |
| Creare e programmare notifiche | [Guida operativa notifiche](docs/notifiche-cms.md) |
| Importare quiz, pubblicarli e gestire i badge | [Guida operativa quiz e badge](docs/quiz-e-badge-cms.md) |
| Capire chi vede una sezione o un contenuto | [Visibilità](#visibilità-di-sezioni-e-pagine) |
| Avviare il progetto sul computer o in sviluppo | [Installazione e avvio](#installazione-e-avvio) |
| Configurare servizi e autorizzazioni AWS | [Configurazione](#configurazione) e [Sicurezza](#sicurezza) |
| Conoscere le funzioni non ancora disponibili | [Limiti attuali](#limiti-attuali) |

### Guida rapida al CMS

Il **CMS** è il pannello per amministrare la webapp, accessibile da `/admin/login`
con credenziali amministrative dedicate. Non usa il codice SMS degli utenti.

1. Accedi e scegli la sezione da gestire.
2. Per guide e libreria, apri un contenuto o creane uno nuovo; inserisci
   testi e media nelle lingue richieste e salva la bozza.
3. Controlla il contenuto, quindi pubblica le modifiche. Per i quiz puoi anche
   selezionare più righe, usare **Seleziona tutti** e pubblicare o riportare
   in bozza i selezionati.
4. Verifica la **visibilità** della sezione e del singolo contenuto: devono
   entrambe consentire l’accesso all’utente destinatario.
5. Per notifiche e quiz puoi partire da Excel: **Importa → Anteprima →
   Conferma**. L’anteprima non salva nulla. Le notifiche confermate seguono
   subito calendario e visibilità; i quiz importati restano bozze finché
   non vengono pubblicati.
6. In **Quiz → Badge** puoi modificare emoji e titoli nelle tre lingue:
   il salvataggio è automatico e mostra il proprio stato.

**Due concetti diversi da non confondere:**

- **Bozza / Online** indica se esiste una versione pubblicata del contenuto.
  Le modifiche salvate in bozza non sostituiscono da sole la versione online.
- **Interno / Anteprima / Pubblicato** indica il pubblico autorizzato:
  rispettivamente amministratori, amministratori più Fincantieri/ELIS,
  oppure tutti gli utenti autenticati. “Pubblicato” non significa accesso anonimo.
  Scegliere la visibilità di un contenuto editoriale pubblica anche l’ultima
  bozza: controllare prima i testi.

Le notifiche sono messaggi **dentro la webapp**, non invii push, email o SMS.
I badge e le letture personali restano associati al profilo dell’utente.

**Dove vengono conservati i dati?** GitHub conserva codice e documentazione;
S3 conserva contenuti, media e configurazioni del CMS; DynamoDB conserva profili,
letture, risultati e date dei badge. Aggiornare GitHub non copia i dati privati
né pubblica automaticamente una nuova versione del sito.

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
22. [Visibilità di sezioni e pagine](#visibilità-di-sezioni-e-pagine)
23. [Calendario notifiche e letture personali](#calendario-notifiche-e-letture-personali)
24. [Quiz collegati alle guide](#quiz-collegati-alle-guide)

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
- Tutte le guide, libreria, quiz, notifiche, traduttore e
  analisi documenti.
- Pannello CMS separato con autenticazione email/password.
- Contenuti multilingua con bozze, pubblicazione e archiviazione su AWS S3.
- Immagini, audio e video localizzati per lingua.
- Immagini delle pagine principali configurabili dal CMS e ordinamento delle
  guide per categoria.
- Gestione dei ruoli applicativi tramite comando operatore, senza endpoint HTTP
  di promozione pubblici.
- Notifiche reali con calendario CMS, import/export Excel, traduzioni, campanella
  e letture personali persistenti.
- Quiz Vero/Falso collegati alle guide, import/export Excel, editor multilingua,
  pubblicazione singola o multipla e statistiche aggregate.
- Raccolta “I miei badge”: sei badge, date di conquista permanenti e titoli
  modificabili dal CMS nelle tre lingue.
- Visibilità per ruolo applicata sia alle sezioni sia ai contenuti.
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
- configurazione AWS/Cognito disponibile nei Replit Secrets (oppure nel file
  `.env` dell'ambiente sul server OVH, vedi `docs/deploy-ovh.md`)
- Docker con Compose plugin solo per il deploy containerizzato

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
| `PUBLIC_APP_URL` | Origine dei link personali legacy, richiesta dallo script di preparazione; mai esposta come variabile `VITE_*` |

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
| `LEGACY_FROM_EMAIL` | nessuno | Mittente dei link legacy, configurato separatamente; nessun ripiego su `SES_FROM_EMAIL` |
| `CORS_ALLOWED_ORIGINS` | vuoto | Origin aggiuntive ammesse da CORS, separate da virgola (es. dominio DEV/PROD sul server OVH) |
| `TRUST_PROXY` | non impostato | Valore `trust proxy` di Express dietro un reverse proxy (`1` con Nginx su OVH), necessario perché il rate limit veda l'IP reale |

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

L'informativa privacy è consultabile anche senza autenticazione all'indirizzo
relativo `/privacy`. In registrazione è obbligatorio spuntare «Ho letto e accetto
l'informativa privacy» prima di poter inviare il codice; la casella parte
deselezionata e si azzera cambiando scheda Accedi/Registrati. Non compare in Accedi.
Al click su «Invia codice», il momento dell'accettazione resta temporaneamente
nello stato del form. **Nessun consenso viene scritto prima della verifica SMS.**
Dopo la conferma del codice e l'accesso alla home, il client attende la riuscita
di `/users/sync`, poi chiama `POST /api/users/consent` con l'ID token Cognito.
L’email è obbligatoria e deve avere un formato valido. Prima di avviare Cognito,
il form controlla il registro legacy come descritto nello step 2 qui sotto.

Il consenso è salvato nel profilo CRM `Step2Connect_Users` nei campi:

| Campo | Valore |
| --- | --- |
| `privacy_policy_consent` | Booleano `true`, mai la stringa `"true"` o il valore `false` |
| `privacyAcceptedAt` | Data e ora del click iniziale, in UTC, formato `YYYYMMDD HH:MM` |

Il server valida il timestamp ISO del click trasmesso dal form e lo converte nel
formato indicato: non usa come data di accettazione il momento successivo della
verifica SMS. Il timestamp del click è dichiarato dal browser, non è una marca
temporale certificata. L'identità proviene soltanto dal numero nel JWT Cognito
verificato; il `userId` del CRM è risolto per telefono e non è assunto uguale al
`sub`. L'endpoint usa esclusivamente `UpdateCommand`, non crea profili mancanti
e conserva atomicamente la prima accettazione anche in caso di richieste simultanee.

Registrati e il percorso legacy chiamano l'endpoint: Accedi ordinario e codice personale sono
invariati. In caso di errore del consenso viene eseguito un solo nuovo tentativo;
un secondo errore produce un messaggio tecnico senza dati personali e non blocca
l'accesso. Se la sincronizzazione del profilo fallisce, il consenso non è scritto
e viene registrato un errore generico. Non c'è un recupero automatico del consenso
nei login successivi.

**Limite esterno da verificare:** l'implementazione di `/users/sync` non è contenuta
in questo repository. Il servizio deve aggiornare i soli campi ricevuti e
preservare gli attributi privacy già presenti; non è stato possibile verificarlo
dal suo codice. L'implementazione locale è stata autorizzata con questa verifica
ancora aperta. La policy `infra/step2connect-users-iam.yaml` comprende già
`dynamodb:UpdateItem`; un eventuale indice telefonico deve proiettare anche i due
attributi privacy per poter rileggere l'accettazione esistente.

Il link nella casella e quello in fondo alla card (anche nello step del codice)
aprono `/privacy` in una nuova scheda senza perdere i dati inseriti. I nuovi testi
sono disponibili in italiano, inglese e bengalese. Aprendo direttamente la privacy,
«Indietro» torna a `/` se non esiste una precedente navigazione interna; per gli
utenti autenticati restano invariati la shell e l'accesso alla privacy esistenti.

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
  il ruolo `standard` o `standard_legacy` (anche `type` assente o stringa vuota) in
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

**Compatibilità pagine:** home, servizi, guide, library, quiz,
notifiche, traduttore, analisi documento, privacy e pagine CMS pubbliche
utilizzano l'utente applicativo oppure API pubbliche, non token Cognito.
LivePerson e WhatsApp restano integrazioni esterne. `GET /api/users/me`,
la sincronizzazione `/users/sync` e `updateMyProfile` (`PATCH /users/me`
del backend esterno) richiedono invece Cognito: non possono usare una sessione
con codice personale. Il login e il ripristino con codice usano il profilo
restituito dalla verifica server e non chiamano queste API.

### Migrazione utenti WordPress: accesso «Bentornato» (step 1)

Gli utenti della vecchia webapp, registrati con email e senza telefono, possono
accedere a `/bentornato?t=<codice>` dal proprio link personale. Questa pagina
riusa la grafica mobile della login e supporta **italiano, inglese e bengalese**.
Il registro è un **CSV privato**, non un contenuto CMS:

```text
user_legacy_s2c_v1/user_legacy_s2c_v1.csv
```

Deve stare nel bucket `S3_BUCKET_NAME`, **mai sotto `content/`, su CloudFront,
in un repository o in un percorso pubblico**. Il browser riceve soltanto i
cinque dati necessari al form, mai il CSV, gli ID o gli stati amministrativi.

#### Preparare il registro

Caricare manualmente l’export WordPress in `private/` (cartella ignorata da
Git). L’export deve contenere queste colonne, in quest’ordine:

```text
id,user_login,user_email,user_registered,display_name,first_name,last_name,full_name,nickname,aziendadiappartenenza,cantierediappartenenza,use_gdpr_agreement,account_status,ruolo,form_id
```

Lo script conserva i valori originali e aggiunge in fondo `link_univoco`,
`link_univoco_status`, `migration_status`. Supporta virgole tra virgolette,
apostrofi, doppi apici e celle su più righe. Prima verificare il solo report:

```bash
node scripts/prepare-legacy-users.mjs private/export-wordpress.csv --dry-run
```

Poi, per creare il registro privato:

```bash
node scripts/prepare-legacy-users.mjs private/export-wordpress.csv
```

- Richiede `PUBLIC_APP_URL`: `https://step-2-connect-v-2.replit.app` per i test,
  **`https://step2connect.it` per la campagna definitiva**, senza `/` finale.
  Il dominio viene usato durante la preparazione: cambiarlo dopo non modifica
  i link già scritti nel registro.
- Per ogni email valida e univoca genera un codice casuale di 32 byte,
  codificato base64url, e il link completo. Stato iniziale: `active` /
  `not_migrated`. Non filtra gli account in base a `account_status` o `ruolo`.
- Il confronto email ignora maiuscole/minuscole e spazi. **Tutte le righe che
  condividono un’email duplicata** restano senza link, non solo la seconda.
  Anche email assenti o non valide restano nel file con le tre nuove celle vuote.
  ID mancanti/duplicati, colonne errate o righe malformate bloccano il caricamento.
- Il report mostra totali, ID delle righe scartate e conteggi per stato account
  e ruolo; non stampa email, nomi, codici o link personali.
- `--dry-run` non legge né scrive S3. Il caricamento normale usa una condizione
  atomica `IfNoneMatch: *`: se il registro esiste, non lo sovrascrive.
- **`--force` sostituisce intenzionalmente il registro e rigenera i codici:
  invalida quindi i link già inviati.** Usarlo solo prima della campagna o per
  una sostituzione deliberata. Nessun caricamento è eseguito automaticamente.

`infra/legacy-users-iam.yaml` documenta la policy
`step2connect-legacy-users-rw` per `step2connect-cms-backend`: soltanto
`s3:GetObject` e `s3:PutObject` sulla singola chiave indicata, con parametro
`ContentBucketName`. Lo stack **`step2connect-legacy-users-iam` è già stato
distribuito da CloudShell con bucket `step2connect-content`**: il file è
documentazione, non richiede un nuovo deploy automatico.

#### Come accede l’utente

1. Il server rilegge il CSV a ogni richiesta, senza cache, confrontando il
   codice con `crypto.timingSafeEqual`. Sono utilizzabili solo righe `active`
   **e** `not_migrated`. Link inesistente, usato o migrato ricevono lo stesso
   errore generico 404. Le richieste sono limitate per IP.
2. La pagina mostra nome, cognome ed email non modificabili. Se entrambi i nomi
   mancano, usa la prima parola di `display_name` come nome e il resto come
   cognome. Azienda e cantiere sono modificabili nelle tendine della
   registrazione: confronto senza distinzione maiuscole/minuscole, valore
   sconosciuto da scegliere nuovamente. Il telefono è obbligatorio, con le
   stesse regole italiane e bangladesi della registrazione. È obbligatoria la
   stessa checkbox privacy della registrazione standard, con testi IT/EN/BN
   e collegamento pubblico a `/privacy`: senza accettazione «Prosegui» è disabilitato.
3. «Prosegui» controlla `/api/users/account-status`. Numero nuovo: registrazione
   Cognito. Numero già presente con flusso Cognito: login SMS, **non** una nuova
   registrazione. In entrambi i casi conserva i dati confermati per il profilo.
   Per preview e codice personale mostra invece un messaggio neutro con
   pulsante verso la login standard: non forza SMS e non chiude la migrazione.
4. Dopo la verifica SMS l’utente entra nella webapp. Sia per numeri nuovi sia
   per numeri già presenti, il browser attende la sincronizzazione riuscita del
   profilo, poi salva il consenso tramite `/api/users/consent`. Invia
   `privacy_policy_consent=true` e `privacyAcceptedAt` con l’istante del click su
   «Prosegui», non quello della verifica SMS. Il server conserva la prima data
   già presente e la memorizza in UTC nel formato `YYYYMMDD HH:MM`.
5. Solo dopo il salvataggio riuscito parte `POST /api/legacy/complete`, con JWT
   Cognito e body `{ token }`. Il server rivalida il link, ricava il telefono
   esclusivamente dal JWT e controlla profilo e consenso salvati. Imposta
   `type=standard_legacy` con aggiornamento DynamoDB condizionale soltanto se il
   tipo è assente, vuoto o `standard`; un `standard_legacy` già impostato è
   idempotente. Non sovrascrive `admin`, `fincantieri_users` o altri valori e
   in questi casi non chiude la migrazione.
6. Solo dopo la scrittura del tipo aggiorna la riga a `used` / `migrated`.
   Usa l’ETag appena letto e `IfMatch`; in caso di conflitto 412
   rilegge e riprova fino a **5 tentativi totali**, preservando gli aggiornamenti
   degli altri utenti. Una riga già chiusa non viene riscritta.

Se la sincronizzazione o il salvataggio del consenso falliscono, l’utente entra
comunque ma la chiusura non parte e il link resta attivo. Il consenso viene
riprovato una volta. Se fallisce la scrittura del tipo, il CSV non viene chiuso.
Se fallisce la chiamata di chiusura, il browser
riprova una sola volta e non blocca l’accesso. Se nessun tentativo scrive, il
link resta attivo e può essere riusato con il numero ormai registrato.
Se invece il server ha scritto ma la risposta è andata persa, il link è già
usato e il tentativo successivo viene correttamente rifiutato.
Un profilo DynamoDB non garantisce un account Cognito: se quest’ultimo manca,
il login SMS mostra il normale errore, senza conversioni automatiche.

Il codice resta solo nella memoria del flusso: nessun `localStorage` o
`sessionStorage`. La query viene rimossa dalla barra degli indirizzi; non
ricaricare la pagina durante la procedura (riaprire il link originale se serve).
Risposte API non memorizzabili, referrer disabilitato e monitoraggio LivePerson
non avviato sulla pagina personale impediscono la diffusione del link tramite
questi canali. I nuovi log tecnici non includono dati personali o codici.

**CRM v2:** `syncProfile` salva i cinque dati nel flusso attuale di
`Step2Connect_Users`; consenso e tipo vengono salvati successivamente come
descritto sopra, senza memorizzare il token nel CRM. `standard_legacy` ha gli
stessi permessi di `standard`: solo sezioni, pagine, notifiche e quiz pubblicati,
nessun accesso CMS. `/me` conserva il tipo; il controllo whitelist lo considera
standard e un successivo login con codice personale può promuoverlo a
`fincantieri_users`. Login ordinario, accessi dedicati e prima data di consenso
esistenti non cambiano. Restano esclusi invio campagne, modifica profilo/numero
e archiviazione dopo 12 mesi.
Il registro non è gestibile dal CMS in questo step.

#### Verifica senza dati reali

`npm test` include i test del CSV, la preparazione, i link, il JWT Cognito,
le scritture condizionali S3, i conflitti, i ruoli protetti e l’ordine
sync/consenso/tipo/chiusura. Con
l’anteprima avviata si può eseguire anche:

```bash
node --experimental-websocket scripts/check-legacy-login-browser.cjs
```

Questo controllo usa il browser reale e risposte simulate per Cognito e API:
copre 24 scenari, senza inviare email o SMS né modificare S3 o CRM. Non sostituisce una
prova operativa con un utente di collaudo e i servizi AWS effettivi.

### Migrazione legacy, step 2: riconoscimento dell’email in Registrati

Nel form **Registrati** l’email è obbligatoria: finché è assente o non valida,
«Invia codice» rimane disabilitato. Gli avvisi sono disponibili in IT/EN/BN.
Il login ordinario non richiede l’email e resta invariato.

Prima del controllo del numero e di qualsiasi richiesta Cognito, il browser
chiama `POST /api/legacy/lookup-email` con il solo body `{ email }`.
Il server rilegge ogni volta il CSV privato, senza cache, e confronta `user_email`
in minuscolo eliminando gli spazi.

| Risposta | Cosa vede l’utente |
| --- | --- |
| `{ status: "none" }` | Registrazione Cognito normale. Vale anche se l’email compare solo in righe senza link, come i duplicati esclusi dalla preparazione. |
| `{ status: "legacy_email_sent" }` | Email inviata all’indirizzo normalizzato della riga CSV con il suo link personale originale. Nessun token o dato CSV nella risposta; nessuna chiamata Cognito. Un popup invita ad aprire l’email e «OK» riporta alla login. |
| `{ status: "migrated" }` | Avviso di accedere con il numero già usato; nessuna richiesta Cognito. |
| Errore di lettura o di invio SES, HTTP 503 | Errore generico nel form; Cognito non viene avviato. |

Il popup, in IT/EN/BN, dice: «Questa email risulta già registrata in Step2Connect.
Ti abbiamo inviato un'email con un link personale: aprilo per proseguire.»
Il browser non riceve il token, non viene portato automaticamente a Bentornato
e non passa più token o telefono nello stato del router. Il link originale
`/bentornato?t=…` arriva esclusivamente via email e apre il percorso dello step 1,
senza banner aggiuntivi: dati CSV, privacy obbligatoria, SMS, consenso,
`standard_legacy` e chiusura del CSV restano invariati.

L’email contiene nella stessa comunicazione testo italiano, inglese e bengalese,
saluto con il nome e avviso di non condividere il link. Viene inviata tramite
`server/lib/sendEmail.js` con AWS SES, **regione esplicita `eu-west-2`** e
mittente esclusivamente da **`LEGACY_FROM_EMAIL`**. Per il collaudo il valore
condiviso tra sviluppo e produzione è `noreply-appmail@b4service.it`, indicato
come già verificato in SES. Dopo la verifica del dominio `step2connect.it` in
`eu-west-2`, sarà sufficiente cambiare la variabile in `noreply@step2connect.it`:
nessuna modifica al codice è necessaria e non esiste un vincolo sul dominio.
Se la variabile manca, è vuota o non contiene un indirizzo valido,
l’endpoint risponde 503 generico, anche durante il periodo di attesa:
non ci sono mittenti di ripiego e Cognito non parte.
Il trasporto email accetta un mittente opzionale esplicito; il reset password
admin non lo passa e continua a usare **`SES_FROM_EMAIL`** come prima.
Non è necessario cambiare il dominio dei link: si usa esattamente quello già nel CSV.

L’endpoint è pubblico, limitato per IP e restituisce `Cache-Control: no-store`.
In aggiunta invia **al massimo un’email per riga ogni dieci minuti**; richieste
entro il periodo ricevono comunque `legacy_email_sent`. Richieste simultanee
per la stessa riga condividono un unico invio. Un errore SES non consuma il periodo
di attesa e viene riportato come 503, senza dati personali nei log.
Questo limite è in memoria nel processo: si azzera al riavvio e non è condiviso
tra istanze, come consentito dal perimetro richiesto.
Il controllo non scrive nel CSV e non consegna al richiedente link o dati personali.

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
- `library`
- `pages`
- `site` (record riservato `app-images` per le immagini globali della webApp)

Il menu CMS è organizzato per sezioni: Tutte le guide, Quiz, Analizza documento,
Notifiche, Traduttore, Immagini app, Altro.
Su mobile diventa una barra di tab scorrevoli. Altro permette di gestire
`library` e le pagine generiche `pages`; l'API legacy `type=all` resta disponibile.

### Campi

Metadati condivisi:

- `id`
- `type`
- `category`
- `url`
- `visibility` per guide, library e pages (non per le immagini `site`)

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
- hero delle cinque categorie guide;
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

Le liste e i dettagli pubblici di guide e library leggono dallo stesso
origin:

```text
/api/content/...
```

In sviluppo la richiesta passa dal proxy Vite; in produzione raggiunge Express
direttamente. `PageResolver` mantiene per compatibilità un override tramite
`VITE_API_BASE_URL` quando la variabile è valorizzata; le nuove letture CMS non
devono estendere questa dipendenza legacy.

La libreria conserva dati statici di fallback per mostrare un contenuto
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
| `GET` | `/api/legacy/link?t=<codice>` | Pubblica, rate limited | Dati minimi di un link legacy attivo |
| `POST` | `/api/legacy/lookup-email` | Pubblica, rate limited, no-store | `none`, `migrated` oppure `legacy_email_sent` dopo invio SES al destinatario CSV; nessun token nella risposta |
| `POST` | `/api/legacy/complete` | JWT Cognito, rate limited | Dopo sync e consenso, imposta `standard_legacy` e chiude il CSV; body `{ token }` |

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
| `PUT` | `/api/admin/content/{type}/{id}/visibility` | Imposta la visibilità e pubblica subito l'ultima bozza salvata |
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
| `/library` | Libreria |
| `/library/:id` | Dettaglio elemento libreria |
| `/quiz` | Quiz |
| `/quiz/:id` | Quiz Vero/Falso collegato a una guida |
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
| `/admin/content` | Redirect a `/admin/content/guide-pratiche` |
| `/admin/content/:section` | Gestione della sezione, visibilità e contenuti |
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
deploy/                         Docker Compose, Nginx e script per il server OVH (B4)
docs/                           runbook operativi (deploy-ovh.md)
Dockerfile                      immagine di produzione (build Vite + Express)
.github/workflows/              CI/CD (deploy DEV su OVH)
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
- visibilità di sezioni e contenuti per ruolo;
- calendario notifiche, import/export Excel e letture personali;
- quiz, punteggi calcolati dal server, pubblicazione e ritorno in bozza;
- configurazione dei badge, sblocco per categoria, Campione e date permanenti.

I controlli browser facoltativi sono in `scripts/check-notifications-browser.cjs`
e `scripts/check-quiz-browser.cjs`; usano API simulate isolate. I file Excel
originali della chat non sono distribuiti nel repository: i controlli che
richiedono tali file devono riceverli separatamente. I test automatici non
equivalgono a una verifica con un vero account sul sito pubblico.

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
- La libreria mantiene fallback statici se l’API non risponde.
- Il cambio lingua può mostrare brevemente il contenuto precedente durante un
  nuovo caricamento.
- L’invio email di reset richiede `SES_FROM_EMAIL` configurato e verificato in
  AWS SES.
- Le notifiche sono esclusivamente interne alla webapp: non vengono inviate
  notifiche push, SMS o email dal calendario.
- Le schede legacy dei servizi usano dati locali, non un CMS
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

### Server B4 (OVH)

È in corso la migrazione su un server B4 ospitato su OVH, con ambienti DEV e
PROD isolati in container Docker dietro Nginx (HTTPS Let's Encrypt). La
procedura completa è in [`docs/deploy-ovh.md`](docs/deploy-ovh.md):

- `deploy/scripts/bootstrap-server.sh`: preparazione una-tantum del server
  (Docker, Nginx, Certbot, firewall, Fail2ban, utente `deploy`, deploy key);
- `deploy/scripts/setup-nginx.sh`: virtual host e certificato per ambiente;
- `deploy/scripts/deploy.sh <dev|prod> [ref]`: build, avvio, health check e
  rollback automatico in caso di errore;
- `.github/workflows/deploy-dev.yml`: test, build e deploy DEV a ogni push su
  `develop` (saltato finché i secret del server non sono configurati).

Le variabili per ambiente partono da `deploy/env/.env.example` e restano solo
sul server (`/opt/step2connect/<env>/.env`). Le `VITE_*` sono incorporate nella
build: dopo una modifica occorre un nuovo deploy.

## Mappa delle aree della webapp

Questa sezione descrive ciò che è implementato, distinguendo contenuti
gestiti dal CMS, dati dimostrativi e integrazioni esterne.

Le sezioni News e Trova uffici sono state rimosse dall'app e dal CMS, inclusi
i controlli di visibilità. I vecchi indirizzi passano dal normale risolutore
delle pagine e, se non esiste una pagina CMS corrispondente, tornano alla Home.
I contenuti News già presenti su S3 non vengono cancellati: l'eventuale pulizia
è manuale. La Libreria resta una sezione distinta, con le sue etichette invariate.

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

### Tutte le guide

L'etichetta è “Tutte le guide” in italiano, “All guides” in inglese e
“সব গাইড” in bengalese. Restano invariati `/guides`, la sezione `guides`,
lo slug CMS `guide-pratiche` e le chiavi S3, inclusi link e visibilità esistenti.

- `/guides`: introduzione al servizio e cinque categorie: Documenti e permessi,
  Salute e pronto soccorso, Casa e bollette, Scuola e famiglia, Vivere in città.
- La categoria Lavoro e busta paga è rimossa: non compare nell'app né nei
  selettori di categorie/immagini del CMS. I vecchi percorsi `/guides/work`
  e `/guides/work/:item` mostrano rispettivamente categoria/guida non trovata.
  Nessun contenuto memorizzato viene cancellato.
- Controllo browser delle sole categorie, con API simulate:
  `node --experimental-websocket scripts/test-visibility-browser.cjs --categories-only`.
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

### Libreria

- `/library`: elenco per categorie di materiali pubblicati nel CMS, con dati
  locali di fallback.
- `/library/:id`: dettaglio del materiale CMS; l'upload diretto di PDF come
  allegati non è ancora implementato.
- Il CMS consente di gestire testi e URL dei materiali, oltre ai media supportati.

### Quiz

- `/quiz`: categorie delle guide con quiz visibili, avanzamento, stelle e badge.
- `/quiz/:id`: domande Vero/Falso IT/EN/BN, spiegazioni, audio opzionale e link ai
  paragrafi della guida, con ritorno al tentativo in corso.
- `/quiz/badges`: raccolta dei sei badge, progressi, date e dettagli delle conquiste.
- Gestione CMS, import/export Excel, statistiche aggregate e risultati persistenti:
  vedere [Quiz collegati alle guide](#quiz-collegati-alle-guide).

### Notifiche

- `/notifications`: notifiche reali gestite dal CMS, con testo nella lingua
  scelta (fallback italiano), emoji iniziale, data relativa e stato di lettura.
- La campanella mostra il conteggio non letto (`9+` oltre nove); aprire una
  notifica la segna come letta prima di aprire la destinazione. È disponibile
  anche “Segna tutte come lette”. Errori di caricamento/salvataggio sono espliciti.
- Il calendario è su S3; le letture sono nel profilo DynamoDB e restano valide
  dopo logout/login da un altro browser. La sezione rispetta la visibilità per ruolo.

### Traduttore e analisi documenti

- `/translator`: inserimento testo e apertura di WhatsApp con messaggio
  precompilato. Il contatto è ancora un segnaposto da configurare.
- `/analyze-document`: apertura del contatto WhatsApp configurato per assistenza
  sui documenti; l'immagine della pagina è personalizzabile dal CMS.
- Nessuna delle due pagine implementa traduzione automatica, upload di documenti
  al backend o analisi AI interna.

### Privacy, pagine generiche e assistenza

- `/privacy`: informativa nell'interfaccia multilingue.
  La pagina si adatta a smartphone e tablet, sia pubblica sia nella shell degli
  utenti autenticati: testo leggibile, indirizzi lunghi a capo e pulsante Indietro
  con area di tocco di almeno 44px. Su desktop il testo ha una larghezza di lettura
  limitata. Lo zoom del browser è consentito per l'accessibilità, anche nelle altre pagine.
- Le route non riconosciute passano al resolver delle pagine CMS per URL, poi
  al fallback. Il resolver conserva l'override legacy del backend documentato.
- LivePerson è un'integrazione esterna: le disponibilità dell'assistenza
  dipendono dalla sua configurazione, non da un servizio di chat interno.

### CMS amministrativo

- `/admin/login`, recupero/reset password e `/admin/account`: credenziali CMS
  separate, reset via email e modifica password.
- `/admin/content/:section`: menu per sezioni con controlli di visibilità,
  contenuti per tipo e filtro lingua; le pagine generiche si gestiscono in Altro.
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

## Visibilità di sezioni e pagine

### Regole e prima attivazione

| Stato | Admin | Fincantieri/ELIS (`fincantieri_users`) | Standard |
|---|---|---|---|
| Interno (`internal`) | Sì | No | No |
| Anteprima (`preview`) | Sì | Sì | No |
| Pubblicato (`published`) | Sì | Sì | Sì |

Una pagina è mostrata soltanto se sono visibili **sia la sezione sia la pagina**.
La Home rimane sempre disponibile e non ha uno stato configurabile.
Gli utenti senza un ruolo esplicito sono trattati come standard per la visibilità.

Se `config/sections.json` manca o ha un formato invalido, si usano questi default:

- Pubblicato: Guide, Analizza documento, Traduttore, Privacy.
- Interno: Quiz, Notifiche, Libreria.

Questi default sono intenzionalmente attivi da subito: le sezioni Interne sono
nascoste agli utenti standard anche se contengono vecchie pagine pubblicate.
Il campo `visibility` mancante nelle pagine esistenti equivale a `published`;
non annulla però la restrizione della sezione. Le pagine nuove nascono `internal`.

### Uso del CMS

- Ogni sezione ha tre pulsanti: Interno, Anteprima, Pubblicato. Il cambio salva
  subito dal server su S3, con `updatedAt` e `updatedBy`.
- La conferma è richiesta solo passando a Pubblicato. Il feedback “Salvato”
  conferma il completamento della richiesta.
- Ogni riga di guide, libreria e pagine generiche ha lo stesso controllo:
  cambiandolo si pubblica immediatamente l'ultima versione **già salvata**, nelle
  tre lingue. Una rinomina rimuove i vecchi URL pubblicati come prima.
- Salvare normalmente una bozza non cambia la sua visibilità e non la pubblica.
  “Pubblica modifiche” aggiorna la copia online, conservando lo stato scelto.
- Le sezioni senza contenuti CMS mostrano la pagina e il percorso in sola lettura.
- In Altro si regolano anche le sezioni Libreria e Privacy. Immagini app e la
  voce contenitore Altro non hanno un proprio stato.
- Dopo un cambio dal CMS, ricaricare l'app per rileggere la configurazione.
  Menu, Home, elenchi e dettagli applicano le stesse regole. Una route di sezione
  non visibile reindirizza a `/home`; un dettaglio non visibile appare non trovato.
- Durante il ripristino Cognito le route attendono il profilo applicativo reale:
  un admin non viene reindirizzato usando il ruolo standard provvisorio.

### API e permessi

- `GET /api/sections`: lettura pubblica, restituisce `{ sections }`, senza scrivere.
- `PUT /api/admin/sections/{key}`: JWT CMS obbligatorio, body `{ "status": "preview" }`.
- `PUT /api/admin/content/{type}/{id}/visibility`: JWT CMS obbligatorio,
  body `{ "visibility": "preview" }`.
- Il server gestisce `config/sections.json`: non crearlo o modificarlo a mano.
  La policy `infra/sections-iam.yaml` consente lettura/scrittura sulla sola chiave.
  Le normali policy contenuti devono consentire le scritture delle bozze e copie online.

**Confine di sicurezza:** per i contenuti CMS generici le regole richieste filtrano navigazione e rendering
dell'app. Le API di lettura contenuti e gli URL dei media restano pubblici come
prima: questa funzionalità non rende riservati i file o i JSON contro richieste
dirette. Non usarla come protezione di documenti o dati confidenziali.
Le nuove API notifiche fanno eccezione: richiedono la sessione utente verificata
e applicano anche sul server la visibilità della sezione.

### Verifica

`npm test` include matrice ruoli/sezione/pagina, salvataggi automatici su storage
simulato, audit, credenziali CMS, default mancanti, contenuti legacy, rinomina e
attesa del profilo al refresh. Il controllo browser opzionale
`node --experimental-websocket scripts/test-visibility-browser.cjs` usa Chromium
e il dominio di sviluppo Replit: tutte le API vengono intercettate con fixture,
senza modificare utenti o file S3 reali.

## Calendario notifiche e letture personali

Per le istruzioni passo passo dedicate agli amministratori, consultare la
[Guida operativa Notifiche nel CMS](docs/notifiche-cms.md): creazione, calendario,
importazione Excel, traduzioni, visibilità e risoluzione dei problemi.

### Calendario e gestione CMS

In **CMS → Notifiche** il selettore di visibilità esistente resta sopra la gestione
del calendario. Sono disponibili:

- Elenco filtrabile per mese, stato attivo e traduzioni mancanti; stato data,
  territorio, guida, messaggio IT e indicatori IT/EN/BN.
- Interruttore attiva/disattiva con salvataggio immediato, nuova notifica,
  modifica e cancellazione con conferma.
- Calendario mensile: selezionare una notifica per modificarla.
- Editor di tutti i campi, selezione guida con compilazione di ID contenuto,
  ID guida e link, testi IT/EN/BN con contatori e anteprima nell'app.
  Oltre 180 caratteri il contatore è arancione, non bloccante. L'ID è stabile
  dopo la creazione; un import con lo stesso ID aggiorna il record.
- Importa da Excel con anteprima di righe nuove/aggiornate, errori e avvisi;
  conferma disabilitata finché ci sono errori. L'anteprima non scrive nulla.
- Esporta Excel per scaricare il calendario corrente e reimportarlo.

Il server gestisce `config/notifications.json` nel bucket configurato. Il file
mancante equivale a un elenco vuoto. Ogni salvataggio che cambia i dati archivia
prima la versione precedente in `config/archive/notifications_<timestamp>.json`;
se l'archivio fallisce, il salvataggio si interrompe. L'import è un'unione per ID:
i record non presenti nel file restano invariati. Un export reimportato senza
modifiche non riscrive dati o audit. Non è necessario creare file S3 a mano.

Gli errori server di importazione/salvataggio indicano il passaggio fallito
(lettura, archivio o scrittura) e un riferimento di diagnosi. I log includono
quel riferimento e i codici tecnici AWS, senza esporre contenuti o credenziali.
Il superamento dell’anteprima non garantisce l’autorizzazione a scrivere su S3.

Ogni record contiene `id`, `obiettivo`, `tipo`, `contentId`, `guideId`, `link`,
`message.{it,en,bn}`, `startDate`, `endDate`, `frequency`, `active`, `territory`,
`dateStatus`, `hook`, `updatedAt`, `updatedBy`.

I tipi validi sono `content_engagement`, `function_engagement` e **`welcome`**
(aggiunto su conferma dell'utente per `N-WELCOME`). Una guida indicata deve
esistere in `content/draft/guides/it/<guideId>.json`; è obbligatoria per
`content_engagement`. Il messaggio IT è obbligatorio. I link accettano percorsi
interni o HTTPS, non JavaScript, HTTP o URL relativi a un altro host (`//...`).

### Import Excel

È supportato `.xlsx` fino a 5 MB, massimo 5000 righe; il foglio preferito è
`Calendario`, altrimenti il primo. Le colonne sono riconosciute per intestazione:

| Colonna | Campo |
|---|---|
| `id_notifica` | `id` |
| `obiettivo`, `tipo_notifica` | `obiettivo`, `tipo` |
| `ID contenuto`, `ID guida CMS`, `pagina` | `contentId`, `guideId`, `link` |
| `data_pubblicazione`, `data_fine` | `startDate`, `endDate` |
| `frequenza`, `notifica_attiva`, `territorio` | `frequency`, `active`, `territory` |
| `Aggancio (perché quella data)`, `Stato data` | `hook`, `dateStatus` |
| `Messaggio IT`, `Messaggio EN`, `Messaggio BN` | `message` |

Le colonne proposte (`Messaggio IT proposto`, `Aggancio proposto`, `Stato data
proposto`) prevalgono se compilate. Le altre colonne sono ignorate.
`Approvazione = Da eliminare` salta la riga con un avviso.
Sono gestite date Excel (anche sistema 1904), formule con risultato già
calcolato e testo `GG/MM/AAAA`. Le formule senza risultato memorizzato non
vengono eseguite. Senza data fine si usano 14 giorni dopo l'inizio.
VERO/TRUE/Sì/1 significano attiva. Gli avvisi includono IT oltre 180 caratteri,
traduzioni mancanti, data passata e più di due notifiche nella stessa settimana
(lunedì–domenica). Gli ID duplicati e le guide inesistenti bloccano la conferma.

Il calendario V3 allegato contiene **45 righe**, cioè le 44 programmate più
`N-WELCOME`; tutte sono valide dopo l'aggiunta esplicita del tipo `welcome`.
Sono verificati N-009 → `gp-registration`, N-011/N-042 → `emergency` e gli avvisi
lunghi per N-015, N-028, N-034, N-035. Il caricamento dell'allegato per i test
non effettua un import automatico sul bucket operativo.

### Visibilità e letture

- Le date sono giorni inclusivi del calendario **Europe/Rome**, indipendenti
  dal fuso del server/browser. Si mostra solo `active=true` nella finestra data.
  `frequency` è conservata come metadato; non genera nuove date o invii automatici.
- Territorio Tutti, oppure corrispondenza senza maiuscole con `sede` del profilo
  DynamoDB. Senza sede sono visibili soltanto le notifiche Tutti.
- Le API accettano ID token Cognito e le sessioni firmate preview/codice personale.
  Queste ultime ricontrollano ruolo e credenziali correnti in whitelist/admin.
  Il token CMS non è una sessione utente.
- `notificationsRead` è una lista nel record esistente, chiave `userId`. Le
  modifiche usano una condizione per telefono e versione della lista, ritentando
  i conflitti, senza modificare altri campi o creare profili. Si conservano gli
  ultimi 300 ID; con un profilo mancante le notifiche restano non lette.
- Caricamento dopo login, al cambio lingua e ogni dieci minuti. Al logout/cambio
  utente o lingua le risposte precedenti non vengono mostrate al nuovo contesto.

### API

| Metodo | Endpoint | Accesso |
|---|---|---|
| GET | `/api/admin/notifications` | JWT CMS |
| PUT / DELETE | `/api/admin/notifications/:id` | JWT CMS |
| POST | `/api/admin/notifications/import/preview` | JWT CMS; multipart `file` |
| POST | `/api/admin/notifications/import/confirm` | JWT CMS; `{notifications:[...]}` |
| GET | `/api/admin/notifications/export` | JWT CMS; download XLSX |
| GET | `/api/notifications?lang=it|en|bn` | Sessione utente; `{items,unread}` |
| POST | `/api/notifications/read?lang=...` | Sessione utente; `{ids:[...]}` |
| POST | `/api/notifications/read-all?lang=...` | Sessione utente |

I record utente restituiti contengono solo `id`, `message` nella lingua richiesta,
`link`, `startDate`, `read`. La sezione Interna è accessibile solo agli admin anche
tramite API; Anteprima anche a `fincantieri_users`, Pubblicata anche agli standard.

### Permessi e verifica

`infra/notifications-iam.yaml` documenta lettura/scrittura della configurazione e
dell'archivio. Occorre inoltre la lettura delle guide draft e la policy DynamoDB
esistente con Scan/Query e UpdateItem. Un eventuale indice telefono deve proiettare
anche `sede` e `notificationsRead`. Non sono state applicate modifiche IAM automatiche.

`npm test` copre autenticazione reale firmata con chiavi di prova, letture,
conflitti, limite 300, date/fuso, territori, fallback lingua, archivio, validazione
Excel e round trip. Il test dell'allegato V3 si esegue quando il file caricato è
disponibile; i test Excel sintetici non dipendono dagli allegati.
`node --experimental-websocket scripts/check-notifications-browser.cjs [file.xlsx]`
verifica campanella, letture, secondo browser, lingua, CMS, import/export e
calendario con API simulate. Controlla le guide reali solo in lettura: non
scrive su S3 o DynamoDB reali.

## Quiz collegati alle guide

Per gestire questa sezione senza conoscere il codice, seguire la
[Guida operativa quiz e badge nel CMS](docs/quiz-e-badge-cms.md).

### Gestione dal CMS

Aprire **CMS → Quiz**. L'elenco riusa lingua, Modifica,
Interno/Anteprima/Pubblicato, Pubblica modifiche ed Elimina dei contenuti editoriali.
La visibilità della sezione e quella del quiz sono controlli distinti:
entrambe devono consentire l'accesso.

1. **Importa da Excel** → selezionare `.xlsx` → **Anteprima import**.
2. Controllare quiz nuovi/aggiornati, errori e avvisi. L'anteprima non scrive.
3. **Conferma import** salva soltanto le bozze nelle tre lingue:
   nuovi quiz in Interno, quiz esistenti con la visibilità precedente.
   La versione già pubblicata non cambia automaticamente.
4. **Pubblica modifiche** rende disponibile la bozza mantenendo la visibilità.
   Anche un quiz Interno deve avere una copia pubblicata per essere giocato
   dagli amministratori.
5. Scegliere Anteprima per `fincantieri_users`, Pubblicato per gli standard.
   Come per le guide, scegliere una visibilità pubblica subito l'ultima bozza:
   controllare prima i testi.

### Pubblicazione e ritorno in bozza di più quiz

Nell’elenco **CMS → Quiz** puoi selezionare i singoli quiz con le caselle oppure
usare **Seleziona tutti** per includere tutti i quiz dell’elenco corrente.
Le azioni **Pubblica selezionati** e **Riporta in bozza** richiedono conferma
e si applicano a tutte e tre le lingue, senza cambiare la visibilità
Interno/Anteprima/Pubblicato.

Riportare in bozza ritira le versioni online: i quiz non sono più disponibili
nel catalogo o nelle guide, nemmeno agli admin nell’app utente. Le bozze, le
modifiche non pubblicate e i risultati già registrati restano conservati.
È possibile pubblicarli nuovamente in seguito.
Durante l’operazione viene mostrato l’avanzamento; in caso di errore parziale
sono indicati i quiz non aggiornati, che restano selezionati per riprovare.
La selezione si riferisce all’elenco corrente e viene azzerata al cambio lingua.

L’API CMS `POST /api/admin/content/quiz/:id/unpublish` ritira un singolo quiz
in tutte le lingue ed è protetta dalla stessa autenticazione amministrativa
della pubblicazione. Le azioni multiple richiamano queste API quiz per quiz.

### Editor e statistiche

**Modifica** apre un editor dedicato con guida in sola lettura e link, soglia,
Vero/Falso e paragrafo per domanda, affermazione/spiegazione e URL audio
IT/EN/BN, aggiunta, eliminazione e riordino delle domande.
Il menu paragrafi usa la bozza italiana con inizio del testo.
I contatori misurano parole: oltre 15 nell'affermazione diventano arancioni,
senza bloccare il salvataggio. I testi italiani sono obbligatori.
Il salvataggio resta bozza fino alla pubblicazione.

La scheda **Statistiche** mostra soltanto aggregati: persone che hanno tentato,
percentuale di persone che hanno superato almeno una volta e correttezza delle
domande al primo tentativo. Sotto il 60% il dato è rosso con link al paragrafo.
N/D indica assenza di risposte iniziali per una domanda.
L'API non restituisce nomi, telefoni o risultati individuali.

### I miei badge

La sezione Quiz presenta le schede **Quiz** e **I miei badge**. La seconda ha
un indirizzo diretto, `/quiz/badges`, soggetto agli stessi permessi della sezione.
Mostra sei badge, barra di avanzamento, data di conquista e progresso per
categoria. I badge bloccati portano ai quiz della rispettiva categoria;
quelli conquistati aprono una scheda di dettaglio.

| Badge | Categoria |
|---|---|
| Esperto burocrate | Documenti e permessi |
| Pronto all’emergenza | Salute e pronto soccorso |
| Casa in regola | Casa e bollette |
| Genitore a pieni voti | Scuola e famiglia |
| Di casa in città | Vivere in città |
| Campione Step2Connect | Tutte le categorie con almeno un quiz visibile |

Il server assegna un badge di categoria dopo il superamento di **tutti i quiz
pubblicati e visibili all’utente** di quella categoria, con almeno un quiz.
Bozze, quiz ritirati e quiz riservati ad altri ruoli non entrano nel conteggio.
Il Campione richiede tutti i badge delle categorie con almeno un quiz visibile:
un catalogo vuoto non assegna alcun badge.

Le date ISO sono conservate nell’attributo DynamoDB `badges`, mappa ID → data,
senza sostituire gli altri campi del profilo. Gli aggiornamenti condizionali
preservano le conquiste concorrenti e la prima data: **un badge ottenuto non
si perde**, anche aggiungendo nuovi quiz o cambiando la visibilità del catalogo.
Il server riconcilia anche i superamenti già registrati quando si apre la
pagina badge. Non crea profili mancanti. A fine quiz restituisce i badge appena
ottenuti, mostrati con animazione e collegamento alla raccolta.

**CMS → Quiz → Badge** consente di cambiare emoji e titoli IT/EN/BN dei sei
badge, con salvataggio automatico, stato di salvataggio e anteprima. ID,
categorie e regole di sblocco non sono modificabili. La configurazione è scritta
solo dal server in `config/quiz-badges.json`; se il file non esiste si usano i
sei valori predefiniti, senza creare file durante la lettura.
Le modifiche compaiono al successivo caricamento della pagina utente.

API, tutte senza accesso anonimo:

- `GET /api/quiz/badges`: definizioni multilingua, stato personale, progresso e date.
- `POST /api/quiz/:id/result`: include `newlyUnlockedBadges` e date conservate.
- `GET /api/admin/quiz/badges`: configurazione completa, autenticazione CMS.
- `PUT /api/admin/quiz/badges`: corpo `{ items: [...] }`, esattamente i sei badge;
  titoli obbligatori nelle tre lingue (massimo 120 caratteri), emoji obbligatoria.

### Excel e dati

Foglio preferito **Quiz 3 lingue**, altrimenti il primo; `.xlsx`, massimo
5 MB e 5000 righe. Intestazioni riconosciute:

| Colonna | Utilizzo |
|---|---|
| ID contenuto | `contentId`, testo con zeri iniziali |
| ID guida CMS | `guideId`; ID quiz `quiz-<guideId>` |
| Domanda | `qid` stabile |
| Risposta | Solo Vero/Falso, convertito in booleano |
| Paragrafo | `p1`, `p2`, ecc. |
| Affermazione IT / EN / BN | Affermazioni nelle tre lingue |
| Spiegazione IT / EN / BN | Spiegazioni nelle tre lingue |

Titolo, Verifica, Note, Modifiche e altre colonne sono ignorate. Categoria,
ordinamento, URL e titoli vengono dalle guide CMS, non dall'Excel.
Qid/risposta/ancora sono condivisi nelle tre lingue.
Le domande importate vengono ordinate per qid; un export inalterato conserva
l'eventuale ordine riordinato nel CMS.

Errori bloccanti: guida italiana inesistente, risposta non valida, testi IT
mancanti, qid duplicati e ancora malformata. Avvisi: EN/BN incompleti,
numero di domande diverso da quattro e ancora oltre i paragrafi della guida.
La conferma ripete la validazione prima di scrivere.

**Esporta Excel** scarica tutti i quiz correnti. Reimportare senza cambiamenti
non riscrive file, audit, audio o visibilità. Le soglie esistenti vengono
conservate; l'import non elimina i quiz assenti dal file.
Verificato il V2 contro le guide reali CMS in sola lettura: **28 quiz,
112 domande, nessun errore o avviso**, medico di base `022` e 112 `023` corretti.
Il test non importa automaticamente l'allegato nel bucket operativo.

I file sono `content/{draft|published|archive}/quiz/{it|en|bn}/...`, con
pubblicazione, visibilità e archiviazione/eliminazione come gli altri contenuti.
Le API pubbliche generiche `/api/content` non espongono i quiz.

### Esperienza utente e risultati

- Compaiono solo le categorie con quiz accessibili, con superati/totali,
  stelle e badge Esperto della categoria.
- Il player presenta segmenti grigi/verdi/rossi e controlli Vero/Falso grandi.
  Dopo la risposta mostra sempre la spiegazione; coriandoli per quella corretta,
  vibrazione breve se supportata per quella errata, nessun suono.
  L'audio opzionale è disponibile solo quando configurato nella lingua.
- **Leggi nella guida** apre `guideUrl#pN`: gli elementi HTML di primo livello
  ricevono ancore in ordine, evidenziate per due secondi. **Torna al quiz**
  riprende la domanda e la risposta in corso.
- Il server calcola punteggio, superamento, stelle e badge dalla versione
  pubblicata: campi score/stelle/superamento inviati dal client sono ignorati.
  Su quattro domande: 4/4 = 3 stelle, 3/4 = 2, 2/4 = 1, meno = 0.
  Con altre lunghezze si usano le equivalenti soglie proporzionali.
  Sono disponibili Rifai e il successivo quiz non superato della categoria.
- In fondo alla guida, la card Mettiti alla prova compare solo se il quiz
  ha una versione pubblicata e accessibile.
- Testi UI IT/EN/BN; testi quiz mancanti con fallback italiano, non audio.

Nel record DynamoDB esistente viene aggiornato solo `quizResults`:
per ID quiz, `firstAnswers` (correttezza, non scelta Vero/Falso),
`firstScore`, `bestScore`, `attempts`, `passedAt`, `lastAt`.
Il primo tentativo non viene mai sovrascritto. Le scritture condizionali
gestiscono conflitti senza modificare ruolo o altri dati.
Senza profilo il quiz funziona senza salvare, con avviso nell'interfaccia.
Le sessioni Cognito e preview/whitelist usano la verifica firmata esistente.

### API, permessi e test

| Metodo | Endpoint | Accesso |
|---|---|---|
| GET | `/api/quiz?lang=it|en|bn` | Utente: catalogo visibile, progressi, badge |
| GET | `/api/quiz/progress` | Utente: propri `quizResults` |
| GET | `/api/quiz/:id?lang=...` | Utente: quiz pubblicato e visibile |
| POST | `/api/quiz/:id/result?lang=...` | Utente: `{answers:{qid:boolean}}` |
| GET / PUT | `/api/admin/content/quiz/:id` | CMS: editor / salvataggio bozza |
| PUT | `/api/admin/content/quiz/:id/visibility` | CMS: visibilità e pubblicazione |
| POST | `/api/admin/content/quiz/:id/publish` | CMS: pubblicazione bozze |
| DELETE | `/api/admin/content/quiz/:id` | CMS: archiviazione e rimozione |
| POST | `/api/admin/quiz/import/preview` | CMS: multipart `file` |
| POST | `/api/admin/quiz/import/confirm` | CMS: `{quizzes:[...]}` |
| GET | `/api/admin/quiz/export` | CMS: XLSX |
| GET | `/api/admin/quiz/:id/stats` | CMS: aggregati |

Occorrono i permessi S3 di lettura/scrittura/copia/eliminazione sui prefissi
quiz, lista chiavi e lettura guide. Per DynamoDB servono lettura per telefono,
Scan per aggregati e UpdateItem sul profilo esistente. Un indice telefono
deve proiettare anche `quizResults`. Nessuna policy AWS viene modificata
automaticamente.

`npm test` copre validazione, metadati guida, lingue, visibilità, calcolo
server, primo tentativo, conflitti, profilo mancante, aggregati ed export/reimport
senza modifiche. Il test dell'allegato V2 è opzionale se assente nel checkout.
`node --experimental-websocket scripts/check-quiz-browser.cjs [file.xlsx]`
verifica categorie, due tentativi, secondo browser, BN, p5 evidenziato e ritorno,
editor/statistiche/import/export CMS e layout mobile con API simulate.
Nessun profilo o quiz reale su AWS viene modificato dai test.