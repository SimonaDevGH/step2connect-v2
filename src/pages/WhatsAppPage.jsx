import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';
import WhatsAppIcon from '../components/WhatsAppIcon';
import WhatsAppServiceCard from '../components/WhatsAppServiceCard';

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
          <WhatsAppServiceCard service="analyze-document" />
        )}
        {visible('translator') && (
          <WhatsAppServiceCard service="translator" />
        )}
      </div>
    </main>
  );
}
