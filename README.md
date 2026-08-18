# Step2Connect v2

> PWA mobile-first per lavoratori bangladesi negli stabilimenti Fincantieri in Italia.  
> Progettata per utenti con bassa alfabetizzazione: testo minimo, icone grandi, supporto trilingue IT / EN / BN.

---

## Indice

1. [Stack tecnico](#stack-tecnico)
2. [Architettura](#architettura)
3. [Avvio locale](#avvio-locale)
4. [Struttura del progetto](#struttura-del-progetto)
5. [Autenticazione utente (Cognito)](#autenticazione-utente-cognito)
6. [Pannello CMS Admin](#pannello-cms-admin)
7. [Contenuti su S3](#contenuti-su-s3)
8. [Route attive](#route-attive)
9. [Variabili d'ambiente e segreti](#variabili-dambiente-e-segreti)
10. [Integrazione LivePerson](#integrazione-liveperson)
11. [Stato attuale e TODO](#stato-attuale-e-todo)
12. [Deploy](#deploy)

---

## Stack tecnico

### Frontend
| Tecnologia | Versione | Ruolo |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Dev server + bundler |
| React Router | v6 | Client-side routing |
| aws-amplify | v6 | SDK Cognito (signUp, signIn, OTP) |
| lucide-react | latest | Icone |
| vite-plugin-pwa | latest | Service Worker + manifest PWA |

### Backend
| Tecnologia | Versione | Ruolo |
|---|---|---|
| Node.js / Express | ≥ 20 | API server REST |
| jsonwebtoken | latest | JWT per sessioni admin CMS |
| @aws-sdk/client-s3 | v3 | Lettura/scrittura contenuti su S3 |
| @aws-sdk/client-ses | v3 | Invio email reset password admin |
| multer | latest | Upload immagini contenuti |
| mime-types | latest | Rilevamento MIME per upload |
| zod | latest | Validazione payload contenuti |
| dotenv / dotenvx | latest | Gestione variabili d'ambiente |

---

## Architettura

```
┌──────────────────────────────────────┐
│              Browser                 │
│  React SPA  ←→  AWS Amplify (auth)   │
│                      ↕               │
│              AWS Cognito             │
│          (User Pool eu-west-2)       │
│           phone + SMS OTP            │
└──────────────┬───────────────────────┘
               │ /api/*
               ↓
┌──────────────────────────────────────┐
│         Express API Server           │
│  dev: porta 3001 (Vite proxia /api)  │
│  prod: porta 5000 (serve anche SPA)  │
│                                      │
│  /api/content/*      → solo lettura  │
│  /api/admin/auth/*   → auth CMS      │
│  /api/admin/content/* → CRUD CMS     │
└──────────────┬───────────────────────┘
               │ AWS SDK v3
               ↓
┌──────────────────────────────────────┐
│             AWS S3                   │
│  content/{draft|published|archive}/  │
│    {type}/{lang}/{id}.json           │
│  admin-users/users.csv               │
│  step2connect/img/{type}/{id}/…      │
└──────────────────────────────────────┘
```

**Dev:** `concurrently` avvia Vite (5000) + Express (3001). Vite proxia tutte le richieste `/api` a `localhost:3001`.  
**Prod:** Express fa il build di Vite (`dist/`) e serve sia le API sia la SPA sullo stesso processo e porta.

---

## Avvio locale

```bash
npm install
npm run dev        # avvia Vite (5000) + Express (3001) in parallelo
npm run build      # build produzione → dist/
npm run preview    # anteprima build produzione
```

Configura i segreti (vedi sezione [Variabili d'ambiente](#variabili-dambiente-e-segreti)) prima di avviare.

---

## Struttura del progetto

```
public/
  favicon.svg
  hero-venezia.jpg
  logo-dark.png
  logo-white.png                         # logo nella top bar
  logo-fincantieri.png
  logo-fincantieri-white.png             # logo bianco nel SideMenu
  analyze-document.jpg
  guides-*.jpg                           # hero immagini categorie guide

src/
  lib/
    cognito.js                           # Inizializza Amplify con User Pool + Client ID
    userApi.js                           # syncProfile / getMyProfile / updateMyProfile → VITE_API_BASE_URL

  context/
    AuthContext.jsx                      # Auth Cognito: signUp (solo phone_number), signIn OTP,
                                         #   autoSignIn, syncProfile post-login; dev bypass via localStorage
    LanguageContext.jsx                  # i18n IT/EN/BN con persistenza localStorage
    AdminAuthContext.jsx                 # JWT admin CMS — decode lato client, persistenza localStorage

  i18n/
    it.js / en.js / bn.js               # Chiavi di traduzione

  components/
    BottomBar.jsx                        # Nav fissa: lingua | home | bot
    SideMenu.jsx                         # Drawer hamburger + link "Gestione contenuti" → /admin/login
    LivePersonBubble.jsx                 # Tracker route LP (lpTag.newPage()) senza UI

  data/
    guides.js                            # Array guide (placeholder — verrà sostituito da CMS S3)

  pages/
    LoginPage.jsx                        # Telefono + OTP (registrazione e login)
    HomePage.jsx                         # Hero, box bot LP, griglia servizi
    GuidesPage.jsx                       # Lista categorie guide
    GuideCategoryPage.jsx                # Guide filtrate per categoria
    GuideDetailPage.jsx                  # Dettaglio singola guida
    PageResolver.jsx                     # Catch-all: cerca pagina CMS su S3, poi 404
    ServiceDetailPage.jsx                # Servizi dinamici (salute/lavoro/scuola/documenti)
    FindOfficesPage.jsx                  # Rubrica uffici Veneto con ricerca
    NewsPage.jsx                         # Feed notizie multilingue
    QuizPage.jsx                         # Quiz 4 domande con punteggio
    LibraryPage.jsx                      # Libreria documenti scaricabili
    NotificationsPage.jsx                # Notifiche push (placeholder)
    TranslatorPage.jsx                   # Apre WhatsApp con testo pre-compilato
    AnalyzeDocumentPage.jsx              # Analisi documenti via WhatsApp +39 349 064 5720
    PrivacyPage.jsx                      # Informativa Privacy + CGC (testo 14/12/2024)

    admin/
      AdminLoginPage.jsx                 # Login email+password CMS → JWT 8h
      AdminForgotPasswordPage.jsx        # Richiesta reset password (risponde sempre 200)
      AdminResetPasswordPage.jsx         # Imposta nuova password via token URL
      AdminContentPage.jsx               # Lista e gestione contenuti CMS
      AdminAccountPage.jsx               # Cambio password admin autenticato
      ContentEditForm.jsx                # Form editor contenuti (trilingue: IT/EN/BN)

  App.jsx                                # Router root: /admin/* → AdminShell, /* → AppShell
  main.jsx
  index.css                              # Stili mobile-first, palette navy #0A1E3A

server/
  index.js                               # Entry point Express, CORS, routing, static prod

  routes/
    content.js                           # GET /api/content — contenuti PUBBLICATI (pubblico)
    admin.js                             # CRUD /api/admin/content — protetto da JWT
    adminAuth.js                         # Login, cambio/reset password, /me — auth CMS

  middleware/
    adminAuth.js                         # requireAdminJWT: verifica JWT con SESSION_SECRET
    auth.js                              # (riservato) Cognito JWT middleware per route utente

  lib/
    s3.js                                # getJson, putJson, putBuffer, listKeys, copyObject
    adminUsers.js                        # CSV utenti admin su S3 (email,name,hash,token,expiry)
    sendEmail.js                         # AWS SES — richiede SES_FROM_EMAIL verificato
    validate.js                          # Schema Zod per payload contenuti
```

---

## Autenticazione utente (Cognito)

Il flusso è **completamente passwordless**: numero di telefono + SMS OTP.  
L'implementazione usa **AWS Amplify v6** con `USER_AUTH` flow.

### Flusso registrazione
```
1. Utente inserisce telefono + dati anagrafici
2. signUp({ username: phoneE164, password: <throwaway uuid+Xz9!>, userAttributes: { phone_number } })
   ↑ IMPORTANTE: solo phone_number viene inviato a Cognito.
     Il pool non ha altri attributi nello schema → inviarne altri causa "Attributes did not conform to the schema".
     Nome, email, azienda, sito vengono salvati nel backend (syncProfile) DOPO il login.
3. autoSignIn → SMS OTP inviato
4. confirmSignUp(phoneE164, codiceOTP)
5. autoSignIn() completa la sessione
6. fetchUserAttributes() + fetchAuthSession() → token ID
7. syncProfile(idToken, { phone, firstName, lastName, email, company, site }) → backend API
```

### Flusso login
```
1. signIn({ username: phoneE164, authFlowType: 'USER_AUTH', preferredChallenge: 'SMS_OTP' })
2. SMS OTP inviato
3. confirmSignIn({ challengeResponse: codiceOTP })
4. fetchUserAttributes() + getIdToken()
5. syncProfile() → aggiorna profilo backend
```

### Password throwaway
Cognito richiede una password anche nei flussi passwordless.  
`crypto.randomUUID()` genera solo hex minuscolo + trattini, non soddisfa la policy Cognito  
(≥ 1 maiuscola, ≥ 1 simbolo). Si usa `${crypto.randomUUID()}Xz9!` come throwaway —  
non viene mai usata per accedere.

### Dev bypass
`devLogin()` in `AuthContext.jsx` scrive un utente fittizio in `localStorage` (`s2c_dev_session`).  
Al mount, se la chiave è presente viene usata senza passare per Cognito.

---

## Pannello CMS Admin

Raggiungibile da `/admin/login` (o dal link "Gestione contenuti ⚙" nel SideMenu).  
**Completamente separato dall'autenticazione Cognito** — usa JWT proprio firmato con `SESSION_SECRET`.

### Utenti admin
Gli utenti admin sono un CSV su S3: `admin-users/users.csv`  
Formato: `email,name,passwordHash,resetToken,resetExpiry`  
- `passwordHash` = `salt:hash` con scrypt (hex, 64 byte)  
- `resetToken` / `resetExpiry` = usati per il flusso di reset password via email

### Route admin
| Metodo | Path | Descrizione |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Verifica email+password → JWT 8h |
| `GET` | `/api/admin/auth/me` | Restituisce dati utente dal JWT |
| `POST` | `/api/admin/auth/change-password` | Cambia password (richiede JWT) |
| `POST` | `/api/admin/auth/forgot-password` | Genera token reset → email SES (sempre 200) |
| `POST` | `/api/admin/auth/reset-password` | Imposta nuova password via token URL |

### Flusso reset password
1. Admin va su `/admin/forgot-password` e inserisce l'email
2. Server genera token hex-32 con scadenza +1 ora, lo salva nel CSV S3
3. AWS SES invia email con link `{origin}/admin/reset-password?token=…`
4. Admin clicca il link → inserisce nuova password (min 8 caratteri)
5. Server verifica token + scadenza → aggiorna hash password, cancella token

> ⚠️ **Pending:** `SES_FROM_EMAIL` non è ancora configurato come Secret Replit.  
> Finché non viene impostato, la chiamata SES lancia eccezione e l'email non parte.

---

## Contenuti su S3

### Schema chiavi S3
```
content/
  draft/      {type}/{lang}/{id}.json   ← bozze CMS (solo admin)
  published/  {type}/{lang}/{id}.json   ← contenuti live (API pubblica)
  archive/    {type}/{lang}/{id}_{ts}.json  ← eliminati (conservati per audit)

admin-users/
  users.csv                             ← utenti CMS admin

step2connect/
  img/{type}/{id}/{timestamp}.{ext}     ← immagini caricate dal CMS
```

### Tipi di contenuto supportati
- `guides` — guide pratiche trilingue
- `news` — notizie
- `library` — documenti scaricabili
- `pages` — pagine CMS generiche (cercate da `PageResolver.jsx` per URL)

### Ciclo di vita contenuto
```
Admin crea/edita → draft su S3 (3 file per lingua: it/en/bn)
Admin clicca "Pubblica" → copyObject da draft/ a published/
Admin clicca "Elimina" → copyObject da draft/ a archive/ (non cancella mai)
```

### API pubblica
`GET /api/content?type=guides&lang=it` → lista contenuti pubblicati  
`GET /api/content/:type/:id?lang=it` → dettaglio singolo  
`GET /api/content/pages-by-url?url=/percorso&lang=it` → pagina per URL

---

## Route attive

### App utente (protette da Cognito)
| Path | Pagina | Note |
|---|---|---|
| `/` | redirect → `/home` | |
| `/home` | HomePage | Hero, box bot LivePerson, griglia servizi |
| `/service/:service` | ServiceDetailPage | salute, lavoro, scuola, documenti |
| `/guides` | GuidesPage | Categorie guide |
| `/guides/:category` | GuideCategoryPage | |
| `/guides/:category/:item` | GuideDetailPage | |
| `/quiz` | QuizPage | |
| `/offices` | FindOfficesPage | Rubrica uffici Veneto |
| `/news` | NewsPage | |
| `/library` | LibraryPage | |
| `/notifications` | NotificationsPage | |
| `/translator` | TranslatorPage | |
| `/analyze-document` | AnalyzeDocumentPage | Bottone WhatsApp |
| `/privacy` | PrivacyPage | |
| `/*` | PageResolver | Cerca pagina CMS su S3, poi 404 |

### Pannello admin (protette da JWT)
| Path | Pagina |
|---|---|
| `/admin/login` | AdminLoginPage |
| `/admin/forgot-password` | AdminForgotPasswordPage |
| `/admin/reset-password` | AdminResetPasswordPage |
| `/admin/content` | AdminContentPage (lista + editor) |
| `/admin/account` | AdminAccountPage (cambio password) |

---

## Variabili d'ambiente e segreti

Tutti configurati come **Replit Secrets** — non committare mai valori reali.

| Variabile | Dove usata | Note |
|---|---|---|
| `VITE_COGNITO_USER_POOL_ID` | `src/lib/cognito.js` | ID del User Pool AWS Cognito (eu-west-2) |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | `src/lib/cognito.js` | Client ID Cognito (app client) |
| `VITE_API_BASE_URL` | `src/lib/userApi.js` | Base URL backend per syncProfile (es. API Gateway) |
| `AWS_ACCESS_KEY_ID` | server — S3 + SES | Credenziali IAM AWS |
| `AWS_SECRET_ACCESS_KEY` | server — S3 + SES | Credenziali IAM AWS |
| `AWS_REGION` | server | Default: `eu-west-2` |
| `S3_BUCKET_NAME` | server | Bucket contenuti e utenti admin |
| `SESSION_SECRET` | server — JWT admin | Secret per firmare/verificare JWT CMS |
| `SES_FROM_EMAIL` | server — `sendEmail.js` | ⚠️ Non ancora configurato — indirizzo verificato SES per email reset password |

---

## Menu laterale (ordine definitivo)

```
Home
Guide pratiche
Quiz
Analizza documento
Trova uffici
Notifiche
──────────────
Privacy Policy
Lingua
Esci
Gestione contenuti ⚙  ← apre /admin/login in nuova tab
[Logo Fincantieri bianco]
```

---

## Integrazione LivePerson

Il tag LP è caricato in `index.html` (siteId `91669831`).

- **Engagement div:** `LP_DIV_1785257734021` in `HomePage.jsx` (sezione Assistente Virtuale)
- **Tracker route:** `LivePersonBubble.jsx` chiama `lpTag.newPage()` ad ogni cambio di route
- **CSP:** meta tag `Content-Security-Policy` in `index.html` include tutti i sottodomini LP:
  - `*.liveperson.net`, `*.lpsnmedia.net`
  - `*.tokenizer.liveperson.net`, `*.idp.liveperson.net`, `*.shiftstatus.liveperson.net`

> Il widget LP non appare finché l'engagement non è attivo nella console LP (normale in staging).

---

## Stato attuale e TODO

### ✅ Completato
- [x] Autenticazione reale AWS Cognito — telefono + SMS OTP (signUp / signIn)
- [x] Fix critico: `signUp` invia **solo `phone_number`** — il pool non accetta altri attributi
- [x] Fix password throwaway Cognito: suffisso `Xz9!` per soddisfare policy maiuscola+simbolo
- [x] `syncProfile` post-login salva nome, email, azienda, sito nel backend (non-blocking)
- [x] Pannello CMS admin (`/admin/*`) — login email+password JWT, completamente separato da Cognito
- [x] CRUD contenuti trilingue (IT/EN/BN) su S3 con stati: draft → published → archive
- [x] Upload immagini contenuti su S3 (JPEG/PNG/WebP/GIF, max 5 MB)
- [x] Gestione account admin: cambio password, forgot/reset via email AWS SES
- [x] Link "Gestione contenuti" nel SideMenu utente
- [x] `PageResolver`: catch-all che cerca pagine CMS su S3 prima del 404

### ⚠️ Pending / Da completare
- [ ] **`SES_FROM_EMAIL`** — configurare il Secret Replit con un indirizzo verificato in AWS SES per attivare le email di reset password admin
- [ ] **Contenuti guide** — popolare S3 con i 26 articoli da step2connect.it tramite il CMS
- [ ] **News** — sostituire array statico `NewsPage.jsx` con contenuti pubblicati via CMS
- [ ] **Libreria** — sostituire array statico `LibraryPage.jsx` con contenuti S3 (task #9)
- [ ] **Pagine CMS nell'app** — collegare `GuideDetailPage.jsx` e `GuideCategoryPage.jsx` ai contenuti pubblicati su S3 (task #8)
- [ ] **Flash di lingua** — prevenire flash di contenuto vecchio al cambio lingua (task #10)
- [ ] **Deploy produzione** — pubblicare l'app su Replit dopo ogni milestone significativa

---

## Deploy

App pubblicata su Replit:  
**https://step-2-connect-v-2.replit.app**

Repository GitHub:  
**https://github.com/SimonaDevGH/step2connect-v2**

> Per pubblicare: usa il pulsante **Publish** nel pannello Replit (non `npm run build` manuale).  
> In produzione Express compila la SPA da `dist/` e serve tutto sulla porta 5000.
