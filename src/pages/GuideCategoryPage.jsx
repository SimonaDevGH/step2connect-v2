import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';

export default function GuideCategoryPage() {
  const { category } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const cat = getCategoryById(category);
  if (!cat) return <div className="page-content"><p className="empty-state">Categoria non trovata</p></div>;

  const Icon = cat.icon;

  return (
    <div className="page-content">
      <div
        className={`page-hero${cat.heroImage ? ' page-hero--image' : ''}`}
        style={cat.heroImage ? {} : { background: cat.color }}
      >
        {cat.heroImage && (
          <img src={cat.heroImage} alt="" className="page-hero-img" />
        )}
        <div className="page-hero-overlay" style={cat.heroImage ? { background: 'rgba(10,30,58,0.22)' } : {}}>
          <button className="back-btn" onClick={() => navigate('/guides')}>
            <ChevronLeft size={24} /> {t('guidesTitle')}
          </button>
          <div className="page-hero-icon">
            <Icon size={40} color="#fff" />
          </div>
          <h2 className="page-hero-title">{t(`guideCat_${cat.id}`)}</h2>
          <p className="page-hero-sub">{t(`guideCat_${cat.id}Desc`)}</p>
        </div>
      </div>

      {cat.empty ? (
        /* ── Coming soon state ────────────────────────────────────────── */
        <div className="coming-soon-wrap">
          <span className="coming-soon-emoji">🛠️</span>
          <p className="coming-soon-title">{t('comingSoon')}</p>
          <p className="coming-soon-desc">{t('comingSoonDesc')}</p>
        </div>
      ) : (
        /* ── Items list ───────────────────────────────────────────────── */
        <div className="guide-items-list">
          {cat.items.map((itemId) => {
            const meta = GUIDE_ITEMS[itemId];
            return (
              <button
                key={itemId}
                className="guide-item-card"
                onClick={() => navigate(`/guides/${cat.id}/${itemId}`)}
                style={{ '--item-color': cat.color }}
              >
                <span className="guide-item-emoji">{meta?.emoji ?? '📌'}</span>
                <div className="guide-item-text">
                  <p className="guide-item-title">{t(`guideItem_${itemId}_title`)}</p>
                  <p className="guide-item-desc">{t(`guideItem_${itemId}_desc`)}</p>
                </div>
                <span className="guide-item-arrow">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
