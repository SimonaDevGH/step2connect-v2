import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const LANGS = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
];

export default function BottomBar() {
  const { lang, changeLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <>
      {/* Language dropdown */}
      {langOpen && (
        <div className="bottom-lang-dropdown">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang-option ${lang === l.code ? 'active' : ''}`}
              onClick={() => { changeLang(l.code); setLangOpen(false); }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <nav className="bottom-bar">
        {/* Left: Language */}
        <button
          className={`bottom-btn ${langOpen ? 'active' : ''}`}
          onClick={() => setLangOpen((v) => !v)}
          aria-label={t('translate')}
        >
          <Languages size={24} />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Center: Home */}
        <button
          className={`bottom-btn bottom-btn-home ${location.pathname === '/home' ? 'active' : ''}`}
          onClick={() => navigate('/home')}
          aria-label={t('home')}
        >
          <Home size={28} />
        </button>

        {/* Right slot intentionally empty — LP injects its own chat button */}
        <div style={{ width: 56 }} />
      </nav>
    </>
  );
}
