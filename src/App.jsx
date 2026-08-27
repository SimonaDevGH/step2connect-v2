import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';

import LoginPage          from './pages/LoginPage';
import HomePage           from './pages/HomePage';
import ServiceDetailPage  from './pages/ServiceDetailPage';
import FindOfficesPage    from './pages/FindOfficesPage';
import NewsPage           from './pages/NewsPage';
import QuizPage           from './pages/QuizPage';
import LibraryPage        from './pages/LibraryPage';
import GuidesPage         from './pages/GuidesPage';
import GuideCategoryPage  from './pages/GuideCategoryPage';
import GuideDetailPage    from './pages/GuideDetailPage';
import ContentDetailPage  from './pages/ContentDetailPage';
import NotificationsPage  from './pages/NotificationsPage';
import TranslatorPage     from './pages/TranslatorPage';
import PrivacyPage        from './pages/PrivacyPage';
import AnalyzeDocumentPage from './pages/AnalyzeDocumentPage';
import PageResolver       from './pages/PageResolver';

import AdminLoginPage          from './pages/admin/AdminLoginPage';
import AdminContentPage        from './pages/admin/AdminContentPage';
import AdminAccountPage        from './pages/admin/AdminAccountPage';
import AdminForgotPasswordPage from './pages/admin/AdminForgotPasswordPage';
import AdminResetPasswordPage  from './pages/admin/AdminResetPasswordPage';

import BottomBar        from './components/BottomBar';
import SideMenu         from './components/SideMenu';
import LivePersonBubble from './components/LivePersonBubble';
import { Menu, Languages } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

const LANGS = [
  { code: 'it', label: 'IT' },
  { code: 'en', label: 'EN' },
  { code: 'bn', label: 'বাং' },
];

// ── Protezione route Cognito ──────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;
  return user ? children : <Navigate to="/" replace />;
}

// ── Protezione route admin JWT ────────────────────────────────────────────────
function AdminProtectedRoute({ children }) {
  const { isLoggedIn } = useAdminAuth();
  return isLoggedIn ? children : <Navigate to="/admin/login" replace />;
}

// ── Shell dell'area admin (completamente separata dal login Cognito) ──────────
function AdminShell() {
  return (
    <Routes>
      <Route path="login"            element={<AdminLoginPage />} />
      <Route path="forgot-password"  element={<AdminForgotPasswordPage />} />
      <Route path="reset-password"   element={<AdminResetPasswordPage />} />
      <Route path="content"          element={<AdminProtectedRoute><AdminContentPage /></AdminProtectedRoute>} />
      <Route path="account"          element={<AdminProtectedRoute><AdminAccountPage /></AdminProtectedRoute>} />
      <Route path="*"                element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

const DIRECT_GUIDE_ROUTES = {
  'guida-al-servizio': { category: 'documents', item: 'guida-al-servizio' },
};

// Le categorie e le guide condividono lo stesso percorso a un segmento.
// Risolviamo qui il segmento speciale senza rompere /guides/documents.
function GuideSingleSegmentPage() {
  const { category: segment } = useParams();
  const directGuide = DIRECT_GUIDE_ROUTES[segment];

  if (directGuide) {
    return (
      <GuideDetailPage
        directCategory={directGuide.category}
        directItem={directGuide.item}
      />
    );
  }

  return <GuideCategoryPage />;
}

// ── Shell principale (app utente con Cognito) ─────────────────────────────────
function AppShell() {
  const { user, authReady } = useAuth();
  const { t, lang, changeLang } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  if (!authReady) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="top-bar">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          <Menu size={26} />
        </button>

        <img src="/logo-white.png" alt="Step2Connect" className="top-bar-logo" />

        <div className="top-lang-wrap">
          <button
            className={`top-lang-btn ${langOpen ? 'active' : ''}`}
            onClick={() => setLangOpen((v) => !v)}
            aria-label="Lingua"
          >
            <Languages size={18} />
            <span>{lang.toUpperCase()}</span>
          </button>
          {langOpen && (
            <div className="top-lang-dropdown top-lang-dropdown--right">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  className={`top-lang-option ${lang === l.code ? 'active' : ''}`}
                  onClick={() => { changeLang(l.code); setLangOpen(false); }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="main-content">
        <Routes>
          <Route path="/"                    element={<Navigate to="/home" replace />} />
          <Route path="/home"                element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/service/:service"    element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
          <Route path="/offices"             element={<ProtectedRoute><FindOfficesPage /></ProtectedRoute>} />
          <Route path="/news"                element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
          <Route path="/news/:id"            element={<ProtectedRoute><ContentDetailPage contentType="news" /></ProtectedRoute>} />
          <Route path="/quiz"                element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/library"             element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/library/:id"         element={<ProtectedRoute><ContentDetailPage contentType="library" /></ProtectedRoute>} />
          <Route path="/guides"              element={<ProtectedRoute><GuidesPage /></ProtectedRoute>} />
          <Route path="/guides/:category"    element={<ProtectedRoute><GuideSingleSegmentPage /></ProtectedRoute>} />
          <Route path="/guides/:category/:item" element={<ProtectedRoute><GuideDetailPage /></ProtectedRoute>} />
          <Route path="/notifications"       element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/translator"          element={<ProtectedRoute><TranslatorPage /></ProtectedRoute>} />
          <Route path="/privacy"             element={<ProtectedRoute><PrivacyPage /></ProtectedRoute>} />
          <Route path="/analyze-document"    element={<ProtectedRoute><AnalyzeDocumentPage /></ProtectedRoute>} />
          {/* Catch-all: prima prova a risolvere come pagina CMS, poi redirect */}
          <Route path="*"                    element={<ProtectedRoute><PageResolver /></ProtectedRoute>} />
        </Routes>
      </main>

      <BottomBar />
      <LivePersonBubble />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <Routes>
              {/* Area admin — routing completamente separato, senza Cognito */}
              <Route path="/admin/*" element={<AdminShell />} />
              {/* App principale */}
              <Route path="/*"       element={<AppShell />} />
            </Routes>
          </AdminAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
