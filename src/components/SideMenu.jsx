import { useNavigate } from 'react-router-dom';
import { X, Home, BookOpen, HelpCircle, FileSearch, MapPin, Bell, ShieldCheck, Languages, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const LANGS = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
];

export default function SideMenu({ open, onClose }) {
  const { t, lang, changeLang } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const go = (path) => { navigate(path); onClose(); };

  const navItems = [
    { icon: <Home size={20} />,        label: t('home'),           path: '/home',          color: '#1D3557' },
    { icon: <BookOpen size={20} />,    label: t('guidesTitle'),    path: '/guides',        color: '#06A77D' },
    { icon: <HelpCircle size={20} />,  label: t('quiz'),           path: '/quiz',          color: '#E9C46A' },
    { icon: <FileSearch size={20} />,  label: t('analyzeTitle'),   path: '/analyze',       color: '#457B9D' },
    { icon: <MapPin size={20} />,      label: t('findOffices'),    path: '/offices',       color: '#6A4C93' },
    { icon: <Bell size={20} />,        label: t('notifications'),  path: '/notifications', color: '#E76F51' },
  ];

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
          {navItems.map((item) => (
            <button key={item.path} className="side-menu-item" onClick={() => go(item.path)}>
              <span className="side-menu-icon" style={{ color: item.color }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="side-menu-divider" />

        {/* Privacy */}
        <button className="side-menu-item" onClick={() => go('/privacy')}>
          <span className="side-menu-icon" style={{ color: '#6b7280' }}><ShieldCheck size={20} /></span>
          <span>{t('privacyTitle')}</span>
        </button>

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
            <img src="/logo-fincantieri-white.png" alt="Fincantieri everyDEI" className="fincantieri-logo" />
          </div>
        </div>
      </aside>
    </>
  );
}
