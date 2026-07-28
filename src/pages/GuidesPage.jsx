import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { GUIDE_CATEGORIES } from '../data/guides';

export default function GuidesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#06A77D' }}>
        <div className="page-hero-icon">📖</div>
        <h2 className="page-hero-title">{t('guidesTitle')}</h2>
        <p className="page-hero-sub">{t('guidesDesc')}</p>
      </div>

      <div className="guides-grid">
        {GUIDE_CATEGORIES.map(({ id, icon: Icon, color, emoji }) => (
          <button
            key={id}
            className="guide-cat-card"
            onClick={() => navigate(`/guides/${id}`)}
            style={{ '--cat-color': color }}
          >
            <div className="guide-cat-icon-wrap">
              <Icon size={30} color={color} />
            </div>
            <p className="guide-cat-name">{t(`guideCat_${id}`)}</p>
            <p className="guide-cat-desc">{t(`guideCat_${id}Desc`)}</p>
            <span className="guide-cat-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
