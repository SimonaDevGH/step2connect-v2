import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function GuideDetailPage() {
  const { category, item } = useParams();
  const { t, lang }        = useLanguage();
  const navigate           = useNavigate();

  const cat  = getCategoryById(category);
  const meta = GUIDE_ITEMS[item];

  const [cmsContent, setCmsContent] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/content/guides/${item}?lang=${lang}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setCmsContent(data || null);
      })
      .catch(() => { if (!cancelled) setCmsContent(null); });
    return () => { cancelled = true; };
  }, [item, lang]);

  if (!cat || !meta) {
    return <div className="page-content"><p className="empty-state">Guida non trovata</p></div>;
  }

  // Usa i dati CMS se disponibili, altrimenti fallback ai dati statici
  const displayTitle = cmsContent?.title || t(`guideItem_${item}_title`);
  const displayDesc  = t(`guideItem_${item}_desc`);
  const hasBody      = cmsContent?.body && cmsContent.body.trim().length > 0;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-hero" style={{ background: cat.color }}>
        <button className="back-btn" onClick={() => navigate(`/guides/${category}`)}>
          <ChevronLeft size={24} /> {t(`guideCat_${category}`)}
        </button>
        <div className="page-hero-icon">{cmsContent?.emoji || meta.emoji}</div>
        <h2 className="page-hero-title">{displayTitle}</h2>
        <p className="page-hero-sub">{displayDesc}</p>
      </div>

      {/* Immagine copertina CMS */}
      {cmsContent?.imageUrl && (
        <img
          src={cmsContent.imageUrl}
          alt={displayTitle}
          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
        />
      )}

      {/* Corpo */}
      <div className="guide-detail-body">
        {cmsContent === undefined ? (
          /* Scheletro di caricamento */
          <div className="guide-section-skeleton">
            <div className="skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ) : hasBody ? (
          /* Contenuto CMS */
          <div
            className="guide-cms-body"
            dangerouslySetInnerHTML={{ __html: cmsContent.body }}
          />
        ) : (
          /* Placeholder — nessun contenuto pubblicato */
          <>
            <div className="guide-placeholder-block">
              <span className="guide-placeholder-icon">📝</span>
              <p className="guide-placeholder-text">{t('guideDetailPlaceholder')}</p>
            </div>
            <div className="guide-section-skeleton">
              <div className="skeleton-title" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
            <div className="guide-section-skeleton">
              <div className="skeleton-title" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
