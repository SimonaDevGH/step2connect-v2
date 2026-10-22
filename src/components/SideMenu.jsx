import { useNavigate } from 'react-router-dom';
import { X, Home, BookOpen, HelpCircle, FileSearch, MapPin, Bell, ShieldCheck, Languages, LogOut, Settings } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { isCmsAdmin } from '../lib/userRoles';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';

const LANGS = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
];

export default function SideMenu({ open, onClose }) {
  const { t, lang, changeLang } = useLanguage();
  const { user, logout, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  const siteImages = useSiteImages();
  const navigate = useNavigate();

  const go = (path) => { navigate(path); onClose(); };

  const navItems = [
    { icon: <Home size={20} />,        label: t('home'),           path: '/home',          color: '#ffffff' },
    { section: 'guides', icon: <BookOpen size={20} />, label: t('guidesTitle'), path: '/guides', color: '#06A77D' },
    { section: 'quiz', icon: <HelpCircle size={20} />, label: t('quiz'), path: '/quiz', color: '#E9C46A' },
    { section: 'analyze-document', icon: <FileSearch size={20} />, label: t('analyzeTitle'), path: '/analyze-document', color: '#457B9D' },
    { section: 'offices', icon: <MapPin size={20} />, label: t('findOffices'), path: '/offices', color: '#6A4C93' },
    { section: 'notifications', icon: <Bell size={20} />, label: t('notifications'), path: '/notifications', color: '#E76F51' },
  ];
  const visibleSection = (key) => profileReady && sectionsReady && canSeeSection(key, user, sections);
  const badge = (key) => user?.type === 'admin' && ['internal', 'preview'].includes(sections[key]?.status)
    ? <span className="section-access-badge">{sections[key].status === 'internal' ? 'Interno' : 'Anteprima'}</span>
    : null;

  return (
    <>
      {open && <div className="overlay" onClick={onClose} />}
      <aside className={`side-menu ${open ? 'open' : ''}`}>
        <div className="side-menu-header">
          <span className="side-menu-title">{t('menu')}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi menu">
            <X size={24} />
          </button>
        </div>

        <nav className="side-menu-nav">
          {navItems.filter((item) => !item.section || visibleSection(item.section)).map((item) => (
            <button key={item.path} className="side-menu-item" onClick={() => go(item.path)}>
              <span className="side-menu-icon" style={{ color: item.color }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.section && badge(item.section)}
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="side-menu-divider" />

        {/* Privacy */}
        {visibleSection('privacy') && <button className="side-menu-item" onClick={() => go('/privacy')}>
          <span className="side-menu-icon" style={{ color: '#6b7280' }}><ShieldCheck size={20} /></span>
          <span>{t('privacyTitle')}</span>
          {badge('privacy')}
        </button>}

        {/* Link al pannello CMS admin: visibile solo agli utenti marcati admin */}
        {isCmsAdmin(user) && (
          <a
            href="/admin/login"
            target="_blank"
            rel="noopener noreferrer"
            className="side-menu-item"
            style={{ textDecoration: 'none', color: 'inherit' }}
            onClick={onClose}
          >
            <span className="side-menu-icon" style={{ color: '#94a3b8' }}><Settings size={20} /></span>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Gestione contenuti</span>
          </a>
        )}

        <div className="side-menu-footer">
          {/* Lingua */}
          <div className="side-menu-lang">
            <Languages size={16} />
            <span>{t('language')}:</span>
            {LANGS.map((l) => (
              <button
                key={l.code}
                className={`lang-pill ${lang === l.code ? 'active' : ''}`}
                onClick={() => changeLang(l.code)}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Esci */}
          <button
            className="side-menu-item logout"
            onClick={() => { logout(); navigate('/'); onClose(); }}
          >
            <LogOut size={20} />
            <span>{t('logout')}</span>
          </button>

          {/* Logo Fincantieri bianco */}
          <div className="side-menu-partner">
            <img src={siteImages.partnerLogo} alt="Fincantieri everyDEI" className="fincantieri-logo" />
          </div>
        </div>
      </aside>
    </>
  );
}
