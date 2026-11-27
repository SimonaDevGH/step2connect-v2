import { ChevronLeft, Languages, MessageCircle, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { WA_ANALYZE_URL, WA_TRANSLATE_URL } from '../lib/whatsapp';

const SERVICES = {
  'analyze-document': {
    icon: Sparkles, color: '#1E8A4C', tint: '#E6F4EC', path: '/analyze-document',
    title: 'waAnalyzeTitle', description: 'waAnalyzeDesc', details: 'waAnalyzeDetails',
    steps: ['waStepTap', 'waAnalyzeStep2', 'waAnalyzeStep3'],
    button: 'waAnalyzeBtn', href: WA_ANALYZE_URL,
  },
  translator: {
    icon: Languages, color: '#118AB2', tint: '#E3F1F7', path: '/translator',
    title: 'waTranslateTitle', description: 'waTranslateDesc', details: 'waTranslateDetails',
    steps: ['waStepTap', 'waTranslateStep2', 'waTranslateStep3'],
    button: 'waTranslateBtn', href: WA_TRANSLATE_URL,
  },
};

export default function WhatsAppServiceCard({ service, detailed = false }) {
  const { t } = useLanguage();
  const { icon: Icon, color, tint, title, description, steps, button, href, path, details } = SERVICES[service];
  return (
    <article className="whatsapp-service-card">
      <header className="whatsapp-service-heading">
        <span className="whatsapp-service-icon" style={{ backgroundColor: tint, color }}>
          <Icon size={24} />
        </span>
        <h2>{t(title)}</h2>
      </header>
      <p className="whatsapp-service-description">{t(description)}</p>
      {detailed && (
        <section className="whatsapp-service-details">
          <h3>{t('waBeforeStarting')}</h3>
          <p>{t(details)}</p>
        </section>
      )}
      <ol className="whatsapp-steps">
        {steps.map((key, index) => (
          <li key={key}>
            <span className="whatsapp-step-number">{index + 1}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>
      <a className="whatsapp-service-cta" href={href} target="_blank" rel="noreferrer">
        <MessageCircle size={20} />
        <span>{t(button)}</span>
      </a>
      {!detailed && <Link className="whatsapp-service-more" to={path}>{t('waLearnMore')}</Link>}
    </article>
  );
}

export function WhatsAppServicePage({ service }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const images = useSiteImages();
  const { icon: Icon, color, title } = SERVICES[service];
  const image = service === 'analyze-document' ? images.analyzeDocumentHero : null;
  return (
    <main className="page-content whatsapp-page whatsapp-detail-page">
      <header
        className="whatsapp-hero whatsapp-detail-hero"
        style={{
          backgroundColor: color,
          ...(image ? { backgroundImage: `linear-gradient(rgba(10,30,58,.7), rgba(10,30,58,.7)), url(${JSON.stringify(image)})` } : {}),
        }}
      >
        <button type="button" className="whatsapp-back" onClick={() => navigate('/home')}>
          <ChevronLeft size={21} /> {t('home')}
        </button>
        <div className="whatsapp-hero-copy">
          <Icon className="whatsapp-hero-icon" aria-hidden="true" />
          <h1>{t(title)}</h1>
        </div>
      </header>
      <div className="whatsapp-services">
        <WhatsAppServiceCard service={service} detailed />
      </div>
    </main>
  );
}
