# Step2Connect v2

> PWA mobile-first per lavoratori bangladesi negli stabilimenti Fincantieri in Italia.  
> Progettata per utenti con bassa alfabetizzazione: testo minimo, icone grandi, supporto trilingue IT / EN / BN.

---

## Stack tecnico

| Tecnologia | Versione | Ruolo |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Dev server + bundler |
| React Router | v6 | Client-side routing |
| lucide-react | latest | Icone |
| vite-plugin-pwa | latest | Service Worker + manifest PWA |

---

## Avvio locale

```bash
npm install
npm run dev      # http://localhost:5000
npm run build    # output → dist/
```

---

## Struttura del progetto

```
public/
  favicon.svg
  hero-venezia.jpg
  logo-dark.png
  logo-white.png
  logo-fincantieri.png
  logo-fincantieri-white.png        # logo bianco nel menu laterale
  analyze-document.jpg              # hero page Analizza documento
  guides-*.jpg                      # immagini hero per le categorie guide

src/
  context/
    AuthContext.jsx                 # Auth mock OTP — stub per AWS Cognito
    LanguageContext.jsx             # i18n IT/EN/BN con persistenza localStorage

  i18n/
    it.js                           # Traduzioni italiano
    en.js                           # Traduzioni inglese
    bn.js                           # Traduzioni bengalese

  components/
    BottomBar.jsx                   # Nav fissa in basso: lingua | home | bot
    SideMenu.jsx                    # Drawer hamburger con logo Fincantieri
    LivePersonBubble.jsx            # Tracker route LP (lpTag.newPage()) — nessuna UI

  data/
    guides.js                       # Array delle 26 guide placeholder

  pages/
    LoginPage.jsx                   # Pre-auth: telefono + OTP (mock, qualsiasi codice)
    HomePage.jsx                    # Hero + box Assistente Virtuale + griglia servizi
    GuidesPage.jsx                  # Lista categorie guide
    GuideCategoryPage.jsx           # Guide filtrate per categoria
    GuideDetailPage.jsx             # Dettaglio singola guida
    ServiceDetailPage.jsx           # Pagina dinamica servizi (salute/lavoro/scuola/documenti)
    FindOfficesPage.jsx             # Rubrica uffici Veneto con ricerca
    NewsPage.jsx                    # Feed notizie multilingue
    QuizPage.jsx                    # Quiz 4 domande con punteggio
    LibraryPage.jsx                 # Libreria documenti scaricabili
    NotificationsPage.jsx           # Notifiche push (mock)
    TranslatorPage.jsx              # Apre WhatsApp con testo pre-compilato
    AnalyzeDocumentPage.jsx         # Analisi documenti via WhatsApp +39 349 064 5720
    PrivacyPage.jsx                 # Informativa Privacy + CGC (testo 14/12/2024)

  App.jsx                           # Router + auth guard + shell
  main.jsx
  index.css                         # Tutti gli stili — mobile-first, palette navy #0A1E3A
```

---

## Route attive

| Path | Pagina | Note |
|---|---|---|
| `/` | redirect → `/home` | |
| `/home` | HomePage | Hero, box bot LP, servizi |
| `/guides` | GuidesPage | Categorie guide |
| `/guides/:category` | GuideCategoryPage | |
| `/guide/:id` | GuideDetailPage | |
| `/quiz` | QuizPage | |
| `/offices` | FindOfficesPage | |
| `/news` | NewsPage | |
| `/notifications` | NotificationsPage | |
| `/translator` | TranslatorPage | |
| `/analyze-document` | AnalyzeDocumentPage | Bottone WhatsApp |
| `/privacy` | PrivacyPage | Testo completo informativa |

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
[Logo Fincantieri bianco]
```

---

## Integrazione LivePerson

Il tag LP è caricato in `index.html` (siteId `91669831`).

- **Engagement div:** `LP_DIV_1785257734021` presente in `HomePage.jsx` (sezione Assistente Virtuale)
- **Tracker route:** `LivePersonBubble.jsx` chiama `lpTag.newPage()` ad ogni cambio di route
- **CSP:** meta tag `Content-Security-Policy` in `index.html` include tutti i sottodomini LP necessari:
  - `*.liveperson.net`, `*.lpsnmedia.net`
  - `*.tokenizer.liveperson.net`, `*.idp.liveperson.net`, `*.shiftstatus.liveperson.net`
  - direttive: `script-src`, `connect-src`, `frame-src`, `img-src`, `media-src`

> Il widget LP non appare finché l'engagement non è attivo nella console LP (normale in staging).

---

## Variabili d'ambiente

| Variabile | Utilizzo |
|---|---|
| `VITE_COGNITO_USER_POOL_ID` | Pool ID AWS Cognito (stub attuale) |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | Client ID AWS Cognito (stub attuale) |
| `VITE_API_BASE_URL` | Base URL backend API (non ancora usato) |
| `SESSION_SECRET` | Secret per sessioni server-side (non ancora usato) |

Configurare come **Replit Secrets** — non committare mai valori reali.

---

## Punti di integrazione futuri

| Feature | File | Da fare |
|---|---|---|
| Auth OTP reale | `src/context/AuthContext.jsx` | Sostituire `sendOTP`/`verifyOTP` con AWS Cognito SDK |
| LivePerson bot attivo | `index.html` + `LivePersonBubble.jsx` | Attivare engagement nella console LP per siteId `91669831` |
| Contenuto guide | `src/data/guides.js` | Migrare i 26 articoli da step2connect.it |
| News / CMS | `src/pages/NewsPage.jsx` | Sostituire array `NEWS` con feed CMS/API |
| Documenti | `src/pages/LibraryPage.jsx` | Sostituire array `DOCUMENTS` con URL S3/CDN reali |
| Uffici | `src/pages/FindOfficesPage.jsx` | Collegare Google Places / OpenStreetMap API |
| Notifiche | `src/pages/NotificationsPage.jsx` | Integrare Firebase FCM o AWS SNS |
| WhatsApp numero | `src/pages/AnalyzeDocumentPage.jsx` | Numero attuale: `+39 349 064 5720` |

---

## Linee guida design

- **Mobile-first** — larghezza massima 480 px
- **Palette:** navy `#0A1E3A` + azzurro `#457B9D`
- **Testo minimo** — icone grandi, target utenti con bassa alfabetizzazione italiana
- **Autenticazione:** telefono + OTP (nessuna password)
- **Lingue:** Italiano · English · বাংলা (Bengali)

---

## Deploy

App pubblicata su Replit Static Deployment:  
**https://step-2-connect-v-2.replit.app**

Repository GitHub:  
**https://github.com/SimonaDevGH/step2connect-v2**
