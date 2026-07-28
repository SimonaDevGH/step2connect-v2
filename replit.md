# Step2Connect v2

Mobile-first PWA for Bangladeshi workers at Fincantieri plants in Italy. Designed for low literacy users with minimal text, clear icons, and trilingual support (IT/EN/BN).

## Stack
- **React 18 + Vite 5** — frontend
- **React Router v6** — client-side routing
- **lucide-react** — icons
- **vite-plugin-pwa** — PWA manifest + service worker

## Run
```
npm install
npm run dev       # http://localhost:5000
npm run build     # dist/
```

## Structure
```
src/
  context/
    AuthContext.jsx       # Mock OTP login — INTEGRATION POINT for AWS Cognito
    LanguageContext.jsx   # IT/EN/BN i18n with localStorage persistence
  i18n/
    it.js / en.js / bn.js # Translation strings
  components/
    BottomBar.jsx         # Fixed bottom nav: language | home | bot
    SideMenu.jsx          # Hamburger side drawer
    LivePersonBubble.jsx  # Chat panel — INTEGRATION POINT for LivePerson SDK
  pages/
    LoginPage.jsx         # Pre-auth: phone + OTP (any code accepted in mock)
    HomePage.jsx          # Hero + bot box + services grid + tools list
    ServiceDetailPage.jsx # Dynamic page for health/work/school/documents
    FindOfficesPage.jsx   # Searchable office directory (Veneto)
    NewsPage.jsx          # News feed with multilingual content
    QuizPage.jsx          # 4-question quiz with scoring
    LibraryPage.jsx       # Downloadable document library
    NotificationsPage.jsx # Push notifications (mock)
    TranslatorPage.jsx    # Opens WhatsApp with pre-filled translation request
  App.jsx                 # Router + auth guard + app shell
  main.jsx
  index.css               # All styles — mobile-first, navy #0A1E3A palette
```

## Integration points
| Feature | File | Notes |
|---------|------|-------|
| OTP / auth | `src/context/AuthContext.jsx` | Replace `sendOTP`/`verifyOTP` with AWS Cognito calls |
| LivePerson bot | `src/components/LivePersonBubble.jsx` | Load `lpTag` script in `index.html`, render into `#lpChat` div |
| WhatsApp translator | `src/pages/TranslatorPage.jsx` | Replace `WA_NUMBER` const with real number |
| News / content | `src/pages/NewsPage.jsx` | Replace `NEWS` array with CMS/API feed |
| Documents | `src/pages/LibraryPage.jsx` | Replace `DOCUMENTS` array with real S3/CDN URLs |
| Offices | `src/pages/FindOfficesPage.jsx` | Replace `OFFICES` array with Google Places / OpenStreetMap API |
| Notifications | `src/pages/NotificationsPage.jsx` | Replace `NOTIFICATIONS` array with Firebase FCM or AWS SNS |

## User preferences
- Mobile-first, max 480px wide
- Palette: navy blue #0A1E3A
- Language support: IT / EN / BN (Bengali)
- Minimal text, large icons — target users have low Italian literacy
- No real passwords — phone + OTP flow only
