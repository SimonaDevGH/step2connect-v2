import { useNavigate } from 'react-router-dom';
import { MapPin, Newspaper, HelpCircle, BookOpen, Bell, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { GUIDE_CATEGORIES } from '../data/guides';

// Single source of truth: pull the 4 featured categories directly from
// GUIDE_CATEGORIES so labels, colors and paths are never duplicated.
const FEATURED_IDS = ['health', 'documents', 'school', 'homeBills'];
const SERVICES = GUIDE_CATEGORIES.filter((c) => FEATURED_IDS.includes(c.id))
  .sort((a, b) => FEATURED_IDS.indexOf(a.id) - FEATURED_IDS.indexOf(b.id));

const TOOLS = [
  { key: 'news',          icon: Newspaper,  color: '#1D3557', path: '/news' },
  { key: 'quiz',          icon: HelpCircle, color: '#E9C46A', path: '/quiz' },
  { key: 'guidesTitle',   icon: BookOpen,   color: '#06A77D', path: '/guides' },
  { key: 'notifications', icon: Bell,       color: '#E76F51', path: '/notifications' },
  { key: 'translator',    icon: Languages,  color: '#118AB2', path: '/translator' },
];

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page-content home-page">
      {/* Hero */}
      <section className="hero">
        <img src="/hero-venezia.jpg" alt="Famiglia a Venezia" className="hero-img" />
        <div className="hero-overlay">
          <div className={`hero-text-block lang-${lang}`}>
            <h2 className="hero-title">
              {t('heroTitle')}{user?.firstName ? `, ${user.firstName}` : ''}
            </h2>
            <p className="hero-subtitle">{t('heroSubtitle')}</p>
          </div>
        </div>
      </section>

      {/* Virtual assistant section */}
      <section className="assistant-section">
        <h3 className="section-title">{t('botTitle')}</h3>
        <p className="assistant-desc">{t('botDesc')}</p>
        <div id="LP_DIV_1785257734021" className="lp-engagement-container"></div>
      </section>

      {/* Services grid */}
      <section className="services-section">
        <h3 className="section-title">{t('servicesTitle')}</h3>
        <div className="services-grid">
          {SERVICES.map(({ id, icon: Icon, color }) => (
            <button
              key={id}
              className="service-card"
              onClick={() => navigate(`/guides/${id}`)}
              style={{ '--service-color': color }}
            >
              <div className="service-icon-wrap">
                <Icon size={32} color={color} />
              </div>
              <p className="service-label">{t(`guideCat_${id}`)}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Offices card */}
      <section className="offices-section">
        <button className="offices-card" onClick={() => navigate('/offices')}>
          <MapPin size={28} color="#6A4C93" />
          <div>
            <p className="offices-title">{t('officesCard')}</p>
            <p className="offices-desc">{t('officesDesc')}</p>
          </div>
        </button>
      </section>

      {/* Tools list */}
      <section className="tools-section">
        <h3 className="section-title">{t('toolsTitle')}</h3>
        <div className="tools-list">
          {TOOLS.map(({ key, icon: Icon, color, path }) => (
            <button key={key} className="tool-item" onClick={() => navigate(path)}>
              <div className="tool-icon" style={{ background: color + '20', color }}>
                <Icon size={22} />
              </div>
              <span className="tool-label">{t(key)}</span>
              <span className="tool-arrow">›</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}
