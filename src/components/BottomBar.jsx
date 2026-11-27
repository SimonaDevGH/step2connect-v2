import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, UserCircle, LogOut, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';
import WhatsAppIcon from './WhatsAppIcon';

export default function BottomBar() {
  const { t } = useLanguage();
  const { user, logout, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  const navigate = useNavigate();
  const location = useLocation();
  const [userOpen, setUserOpen] = useState(false);
  const showWhatsApp = profileReady && sectionsReady && canSeeSection('whatsapp', user, sections);

  const handleLogout = async () => {
    setUserOpen(false);
    await logout();
  };

  return (
    <>
      {/* User panel */}
      {userOpen && (
        <div className="bottom-user-panel">
          <div className="user-panel-header">
            <div className="user-panel-avatar">
              <UserCircle size={32} />
            </div>
            <div className="user-panel-info">
              <span className="user-panel-name">{user?.name || user?.phone}</span>
              {user?.site && <span className="user-panel-site">{user.site}</span>}
            </div>
            <button className="user-panel-close" onClick={() => setUserOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <button className="user-panel-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>{t('logout') || 'Esci'}</span>
          </button>
        </div>
      )}

      <nav className="bottom-bar">
        {/* Left: User */}
        <button
          className={`bottom-btn ${userOpen ? 'active' : ''}`}
          onClick={() => setUserOpen((v) => !v)}
          aria-label={t('profile')}
        >
          <UserCircle size={24} />
          <span>{t('profile')}</span>
        </button>

        {/* Center: Home */}
        <button
          className={`bottom-btn bottom-btn-home ${location.pathname === '/home' ? 'active' : ''}`}
          onClick={() => navigate('/home')}
          aria-label={t('home')}
        >
          <Home size={28} />
        </button>

        {showWhatsApp ? (
          <button
            type="button"
            className={`bottom-btn bottom-btn-whatsapp ${location.pathname === '/whatsapp' ? 'active' : ''}`}
            onClick={() => navigate('/whatsapp')}
            aria-label={t('whatsapp')}
            aria-current={location.pathname === '/whatsapp' ? 'page' : undefined}
          >
            <WhatsAppIcon className="bottom-whatsapp-icon" />
            <span>{t('whatsapp')}</span>
          </button>
        ) : <div className="bottom-btn-placeholder" aria-hidden="true" />}
        <div className="bottom-btn-placeholder" aria-hidden="true" />
      </nav>
    </>
  );
}
