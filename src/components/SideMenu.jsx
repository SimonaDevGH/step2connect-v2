import { useNavigate } from 'react-router-dom';
import { X, Heart, Briefcase, GraduationCap, FileText, MapPin, Newspaper, HelpCircle, BookOpen, Bell, Languages, LogOut } from 'lucide-react';
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
    { icon: <Heart size={20} />, label: t('health'), path: '/service/health', color: '#E63946' },
    { icon: <Briefcase size={20} />, label: t('work'), path: '/service/work', color: '#F4A261' },
    { icon: <GraduationCap size={20} />, label: t('school'), path: '/service/school', color: '#2A9D8F' },
    { icon: <FileText size={20} />, label: t('documents'), path: '/service/documents', color: '#457B9D' },
    { icon: <MapPin size={20} />, label: t('findOffices'), path: '/offices', color: '#6A4C93' },
    { icon: <Newspaper size={20} />, label: t('news'), path: '/news', color: '#1D3557' },
    { icon: <HelpCircle size={20} />, label: t('quiz'), path: '/quiz', color: '#E9C46A' },
    { icon: <BookOpen size={20} />, label: t('library'), path: '/library', color: '#06A77D' },
    { icon: <Bell size={20} />, label: t('notifications'), path: '/notifications', color: '#E76F51' },
    { icon: <Languages size={20} />, label: t('translator'), path: '/translator', color: '#118AB2' },
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

        <div className="side-menu-footer">
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
          <button
            className="side-menu-item logout"
            onClick={() => { logout(); navigate('/'); onClose(); }}
          >
            <LogOut size={20} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
