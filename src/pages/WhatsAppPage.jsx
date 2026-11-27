import { ChevronLeft, Languages, MessageCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';
import { WA_ANALYZE_URL, WA_TRANSLATE_URL } from '../lib/whatsapp';
import WhatsAppIcon from '../components/WhatsAppIcon';

function ServiceSteps({ keys, t }) {
  return (
    <ol className="whatsapp-steps">
      {keys.map((key, index) => (
        <li key={key}>
          <span className="whatsapp-step-number">{index + 1}</span>
          <span>{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}

function ServiceCard({ icon: Icon, color, tint, title, description, steps, button, href, t }) {
  return (
    <article className="whatsapp-service-card">
      <header className="whatsapp-service-heading">
        <span className="whatsapp-service-icon" style={{ backgroundColor: tint, color }}>
          <Icon size={24} />
        </span>
        <h2>{t(title)}</h2>
      </header>
      <p className="whatsapp-service-description">{t(description)}</p>
      <ServiceSteps keys={steps} t={t} />
      <a className="whatsapp-service-cta" href={href} target="_blank" rel="noreferrer">
        <MessageCircle size={20} />
        <span>{t(button)}</span>
      </a>
    </article>
  );
}

export default function WhatsAppPage() {
  const { t } = useLanguage();
  const { user, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  const navigate = useNavigate();
  const visible = (key) => profileReady && sectionsReady && canSeeSection(key, user, sections);

  return (
    <main className="page-content whatsapp-page">
      <header className="whatsapp-hero">
        <button type="button" className="whatsapp-back" onClick={() => navigate('/home')}>
          <ChevronLeft size={21} /> {t('home')}
        </button>
        <div className="whatsapp-hero-copy">
          <WhatsAppIcon className="whatsapp-hero-icon" />
          <div>
            <h1>{t('waPageTitle')}</h1>
            <p>{t('waPageSub')}</p>
          </div>
        </div>
      </header>

      <div className="whatsapp-services">
        {visible('analyze-document') && (
          <ServiceCard
            icon={Sparkles}
            color="#1E8A4C"
            tint="#E6F4EC"
            title="waAnalyzeTitle"
            description="waAnalyzeDesc"
            steps={['waStepTap', 'waAnalyzeStep2', 'waAnalyzeStep3']}
            button="waAnalyzeBtn"
            href={WA_ANALYZE_URL}
            t={t}
          />
        )}
        {visible('translator') && (
          <ServiceCard
            icon={Languages}
            color="#118AB2"
            tint="#E3F1F7"
            title="waTranslateTitle"
            description="waTranslateDesc"
            steps={['waStepTap', 'waTranslateStep2', 'waTranslateStep3']}
            button="waTranslateBtn"
            href={WA_TRANSLATE_URL}
            t={t}
          />
        )}
      </div>
    </main>
  );
}
