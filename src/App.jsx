import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import FindOfficesPage from './pages/FindOfficesPage';
import NewsPage from './pages/NewsPage';
import QuizPage from './pages/QuizPage';
import LibraryPage from './pages/LibraryPage';
import GuidesPage from './pages/GuidesPage';
import GuideCategoryPage from './pages/GuideCategoryPage';
import GuideDetailPage from './pages/GuideDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import TranslatorPage from './pages/TranslatorPage';
import PrivacyPage from './pages/PrivacyPage';
import AnalyzeDocumentPage from './pages/AnalyzeDocumentPage';

import BottomBar from './components/BottomBar';
import SideMenu from './components/SideMenu';
import LivePersonBubble from './components/LivePersonBubble';
import { Menu } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

function AppShell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div style={{ width: 40 }} />
      </header>

      {/* Side menu */}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Page content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/service/:service" element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
          <Route path="/offices" element={<ProtectedRoute><FindOfficesPage /></ProtectedRoute>} />
          <Route path="/news" element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
          <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><GuidesPage /></ProtectedRoute>} />
          <Route path="/guides" element={<ProtectedRoute><GuidesPage /></ProtectedRoute>} />
          <Route path="/guides/:category" element={<ProtectedRoute><GuideCategoryPage /></ProtectedRoute>} />
          <Route path="/guides/:category/:item" element={<ProtectedRoute><GuideDetailPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/translator" element={<ProtectedRoute><TranslatorPage /></ProtectedRoute>} />
          <Route path="/privacy" element={<ProtectedRoute><PrivacyPage /></ProtectedRoute>} />
          <Route path="/analyze" element={<ProtectedRoute><AnalyzeDocumentPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      {/* Fixed bottom bar */}
      <BottomBar />

      {/* LivePerson — mounts once to track route changes; LP renders its own chat button */}
      <LivePersonBubble />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
