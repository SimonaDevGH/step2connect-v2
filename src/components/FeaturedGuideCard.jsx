import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { canSeeVisibility } from '../lib/sectionAccess';

export default function FeaturedGuideCard({ featuredGuide }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!canSeeVisibility(featuredGuide?.visibility, user)) return null;

  return (
    <div className="guides-featured-wrap">
      <button
        type="button"
        className="guide-featured-card"
        onClick={() => navigate('/guides/guida-al-servizio')}
      >
        <span className="guide-featured-emoji">{featuredGuide?.emoji || '📘'}</span>
        <span className="guide-featured-text">
          <span className="guide-featured-title">
            {featuredGuide?.title || t('featuredGuideTitle')}
          </span>
          <span className="guide-featured-desc">
            {featuredGuide?.metaDesc || t('featuredGuideDesc')}
          </span>
        </span>
        <span className="guide-featured-arrow">›</span>
      </button>
    </div>
  );
}
