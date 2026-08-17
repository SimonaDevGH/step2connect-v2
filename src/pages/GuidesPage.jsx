import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { GUIDE_CATEGORIES } from '../data/guides';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function GuidesPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  // Track which categories have published content available via the API.
  // Falls back gracefully: if the API is unreachable every category stays enabled.
  const [publishedIds, setPublishedIds] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/content?type=guides&lang=${lang}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          // Collect the set of category ids that have at least one published guide
          const ids = new Set(data.map((item) => item.category).filter(Boolean));
          setPublishedIds(ids);
        }
      })
      .catch(() => {
        // API unavailable — keep publishedIds null (no restriction applied)
      });
  }, [lang]);

  return (
    <div className="page-content">
      <div className="guides-hero">
        <img src="/guides-hero.png" alt="" className="guides-hero-img" />
        <div className="guides-hero-overlay">
          <span className="guides-hero-emoji">📖</span>
          <h2 className="guides-hero-title">{t('guidesTitle')}</h2>
          <p className="guides-hero-sub">{t('guidesDesc')}</p>
        </div>
      </div>

      <div className="guides-grid">
        {GUIDE_CATEGORIES.map(({ id, icon: Icon, color, emoji }) => {
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
