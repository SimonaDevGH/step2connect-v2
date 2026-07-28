import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const PRIVACY_URL = 'https://step2connect.it/register/privacy-policy-e-condizioni-generali/';

export default function PrivacyPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-content privacy-page">
      <div className="page-hero" style={{ background: 'var(--navy)' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} /> {t('menu')}
        </button>
        <h2 className="page-hero-title">{t('privacyTitle')}</h2>
      </div>

      <iframe
        src={PRIVACY_URL}
        className="privacy-iframe"
        title="Privacy Policy"
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}
