import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { GUIDE_CATEGORIES } from '../data/guides';
import FeaturedGuideCard from '../components/FeaturedGuideCard';
import useFeaturedGuide from '../lib/useFeaturedGuide';

export default function GuidesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const siteImages = useSiteImages();
  const { publishedIds, featuredGuide } = useFeaturedGuide();

  return (
    <div className="page-content">
      <div className="guides-hero">
        <img src={siteImages.guidesHero} alt="" className="guides-hero-img" />
        <div className="guides-hero-overlay">
          <span className="guides-hero-emoji">📖</span>
          <h2 className="guides-hero-title">{t('guidesTitle')}</h2>
          <p className="guides-hero-sub">{t('guidesDesc')}</p>
        </div>
      </div>

      <FeaturedGuideCard featuredGuide={featuredGuide} />

      <div className="guides-grid">
        {GUIDE_CATEGORIES.map(({ id, icon: Icon, color }) => {
          // If the API returned data, show a subtle indicator for categories
          // that have published content; otherwise show all categories normally.
          const hasContent = publishedIds === null || publishedIds.has(id);
          return (
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
              {hasContent && publishedIds !== null && (
                <span className="guide-cat-badge" title="Contenuto disponibile">●</span>
              )}
              <span className="guide-cat-arrow">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
