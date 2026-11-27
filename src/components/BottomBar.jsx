import { useNavigate, useLocation } from 'react-router-dom';
import { Home, UserCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';
import WhatsAppIcon from './WhatsAppIcon';

export default function BottomBar() {
  const { t } = useLanguage();
  const { user, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  const navigate = useNavigate();
  const location = useLocation();
  const showWhatsApp = profileReady && sectionsReady && canSeeSection('whatsapp', user, sections);
  const onProfile = location.pathname === '/profile' || location.pathname.startsWith('/profile/');

  return (
      <nav className="bottom-bar">
        {/* Left: User */}
        <button
          className={`bottom-btn ${onProfile ? 'active profile-bottom-active' : ''}`}
          onClick={() => navigate('/profile')}
          aria-label={t('profile')}
          aria-current={onProfile ? 'page' : undefined}
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
  );
}
