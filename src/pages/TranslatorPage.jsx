import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── INTEGRATION POINT ────────────────────────────────────────────────────────
// WhatsApp translator: opens wa.me with pre-filled text.
// The WhatsApp number below should be configured to a human translator or
// a WhatsApp Business API bot (e.g. Twilio, 360dialog) that handles translations.
// Replace WA_NUMBER with the actual translator number.
// ─────────────────────────────────────────────────────────────────────────────
const WA_NUMBER = '393331234567'; // TODO: replace with real number

export default function TranslatorPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const openWhatsApp = () => {
    if (!text.trim()) return;
    const message = encodeURIComponent(t('waMessage') + text);
    window.open(`https://wa.me/${WA_NUMBER}?text=${message}`, '_blank');
  };

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#118AB2' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">🌐</div>
        <h2 className="page-hero-title">{t('translatorTitle')}</h2>
        <p className="page-hero-sub">{t('translatorDesc')}</p>
      </div>

      <div className="translator-body">
        <div className="translator-card">
          <MessageSquare size={32} color="#118AB2" />
          <p className="trans-hint">{t('translatorHint')}</p>
          <textarea
            className="trans-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('translatorHint') + '...'}
            rows={5}
          />
          <button
            className="btn-whatsapp"
            onClick={openWhatsApp}
            disabled={!text.trim()}
          >
            <span>📱</span> {t('openWhatsApp')}
          </button>
          <p className="trans-note">
            {t('waMessage')} ...
          </p>
        </div>
      </div>
    </div>
  );
}
