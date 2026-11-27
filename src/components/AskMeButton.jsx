import { MessageCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function AskMeButton({ className = '', icon: Icon = MessageCircle }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const goToAskMe = () => {
    if (location.pathname === '/home') {
      document.getElementById('ask-me')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate('/home', { state: { scrollToAskMe: true } });
  };

  return (
    <button type="button" className={`ask-me-button ${className}`.trim()} onClick={goToAskMe} aria-label={t('botTitle')}>
      <span className="ask-me-button-icon"><Icon size={25} /></span>
      <span className="ask-me-button-label">{t('botTitle')}</span>
    </button>
  );
}
