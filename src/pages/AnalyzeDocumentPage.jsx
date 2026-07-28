import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const WA_NUMBER = '393490645720';

export default function AnalyzeDocumentPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(t('analyzeWaText'))}`;

  return (
    <div className="page-content analyze-page">
      <div className="page-hero" style={{ background: 'var(--navy)' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} /> {t('menu')}
        </button>
        <h2 className="page-hero-title">{t('analyzeTitle')}</h2>
      </div>

      <div className="analyze-body">
        <p className="analyze-desc">{t('analyzeDesc')}</p>

        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="wa-btn"
        >
          {/* WhatsApp SVG icon */}
          <svg viewBox="0 0 32 32" className="wa-icon" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="#25D366"/>
            <path fill="#fff" d="M23.5 8.5A10.44 10.44 0 0 0 16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.41 5.25L5.5 26.5l5.39-1.41A10.46 10.46 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5 0-2.8-1.09-5.43-3-7.5zm-7.5 16.15c-1.65 0-3.27-.44-4.68-1.28l-.34-.2-3.2.84.85-3.1-.22-.35A8.7 8.7 0 0 1 7.3 16c0-4.8 3.91-8.7 8.71-8.7 2.33 0 4.51.91 6.16 2.55a8.65 8.65 0 0 1 2.54 6.15c-.01 4.8-3.92 8.65-8.71 8.65zm4.77-6.51c-.26-.13-1.55-.76-1.79-.85-.24-.09-.41-.13-.58.13-.17.26-.66.85-.81 1.02-.15.17-.3.2-.56.07-.26-.13-1.1-.41-2.1-1.3-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.58-1.4-.8-1.92-.21-.5-.43-.43-.58-.44h-.5c-.17 0-.45.06-.68.32-.24.26-.9.88-.9 2.14s.92 2.48 1.05 2.65c.13.17 1.81 2.76 4.38 3.87.61.26 1.09.42 1.46.54.61.19 1.17.16 1.61.1.49-.07 1.51-.62 1.72-1.21.21-.6.21-1.11.15-1.21-.06-.1-.23-.16-.49-.29z"/>
          </svg>
          {t('analyzeWaBtn')}
        </a>
      </div>
    </div>
  );
}
