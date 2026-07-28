import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Briefcase, GraduationCap, FileText, MapPin, Newspaper, HelpCircle, BookOpen, Bell, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

import LivePersonBubble from '../components/LivePersonBubble';

const SERVICES = [
  { key: 'health',    icon: Heart,         color: '#E63946', path: '/service/health' },
  { key: 'work',      icon: Briefcase,     color: '#F4A261', path: '/service/work' },
  { key: 'school',    icon: GraduationCap, color: '#2A9D8F', path: '/service/school' },
  { key: 'documents', icon: FileText,      color: '#457B9D', path: '/service/documents' },
];

const TOOLS = [
  { key: 'news',          icon: Newspaper,  color: '#1D3557', path: '/news' },
  { key: 'quiz',          icon: HelpCircle, color: '#E9C46A', path: '/quiz' },
  { key: 'library',       icon: BookOpen,   color: '#06A77D', path: '/library' },
  { key: 'notifications', icon: Bell,       color: '#E76F51', path: '/notifications' },
  { key: 'translator',    icon: Languages,  color: '#118AB2', path: '/translator' },
];

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [botOpen, setBotOpen] = useState(false);

  return (
    <div className="page-content home-page">
      {/* Hero */}
      <section className="hero">
        <img src="/hero-venezia.jpg" alt="Famiglia a Venezia" className="hero-img" />
        <div className="hero-overlay">
          <div className={`hero-text-block lang-${lang}`}>
            <h2 className="hero-title">{t('heroTitle')}</h2>
            {user?.name && (
              <p className="hero-subtitle">{user.name}</p>
            )}
            <p className="hero-subtitle">{t('heroSubtitle')}</p>
          </div>
        </div>
      </section>

      {/* Bot box placeholder */}
      <section className="bot-section">
        <div className="bot-card" onClick={() => setBotOpen(true)}>
          <div className="bot-avatar">🤖</div>
          <div>
            <p className="bot-title">{t('botTitle')}</p>
            <p className="bot-desc">{t('botDesc')}</p>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="services-section">
        <h3 className="section-title">{t('servicesTitle')}</h3>
        <div className="services-grid">
          {SERVICES.map(({ key, icon: Icon, color, path }) => (
            <button
              key={key}
              className="service-card"
              onClick={() => navigate(path)}
              style={{ '--service-color': color }}
            >
              <div className="service-icon-wrap">
                <Icon size={32} color={color} />
              </div>
              <p className="service-label">{t(key)}</p>
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

      {/* LivePerson bubble */}
      <LivePersonBubble open={botOpen} onClose={() => setBotOpen(false)} />
    </div>
  );
}
