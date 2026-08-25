import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';

// L'API pubblica è sullo stesso origin dell'app: in sviluppo Vite inoltra
// /api a Express e in produzione Express serve entrambe le parti.
const API = '';

export default function GuideDetailPage() {
  const { category, item } = useParams();
  const { t, lang }        = useLanguage();
  const navigate           = useNavigate();

  const cat  = getCategoryById(category);
  const meta = GUIDE_ITEMS[item];

  const [cmsContent, setCmsContent] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    setCmsContent(undefined);
    fetch(`${API}/api/content/guides/${encodeURIComponent(item)}?lang=${lang}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setCmsContent(data || null);
      })
      .catch(() => { if (!cancelled) setCmsContent(null); });
    return () => { cancelled = true; };
  }, [item, lang]);

  if (!cat) {
    return <div className="page-content"><p className="empty-state">Guida non trovata</p></div>;
  }

  // Il CMS può contenere nuove guide non presenti nel catalogo statico.
  const displayTitle = cmsContent?.title || (meta ? t(`guideItem_${item}_title`) : t('guidesTitle'));
  const displayDesc  = cmsContent?.metaDesc || (meta ? t(`guideItem_${item}_desc`) : '');
  const hasBody      = cmsContent?.body && cmsContent.body.trim().length > 0;
  const hasPublishedContent = cmsContent !== undefined && cmsContent !== null;
  const hasCoverImage = Boolean(cmsContent?.imageUrl);
  const isResidencePermitGuide =
    item === 'permitRequest' ||
    /permesso di soggiorno|residence permit|বাসস্থান পারমিট/i.test(displayTitle);
  const videoLabel = isResidencePermitGuide
    ? t('guidePermitVideoPrompt')
    : t('guideVideoPrompt');
  const audioLabel = isResidencePermitGuide
    ? t('guidePermitAudioPrompt')
    : t('guideAudioPrompt');
  const textHeading = isResidencePermitGuide
    ? t('guidePermitTextHeading')
    : `📄 ${displayTitle}`;

  return (
    <div className="page-content">
      {/* Header */}
      <div
        className={`page-hero${hasCoverImage ? ' page-hero--image' : ''}`}
        style={hasCoverImage ? undefined : { background: cat.color }}
      >
        {hasCoverImage && (
          <img
            src={cmsContent.imageUrl}
            alt=""
            className="page-hero-img guide-detail-hero-img"
          />
        )}
        <div
          className={hasCoverImage ? 'page-hero-overlay guide-detail-hero-overlay' : undefined}
        >
          <button className="back-btn" onClick={() => navigate(`/guides/${category}`)}>
            <ChevronLeft size={24} /> {t(`guideCat_${category}`)}
          </button>
          <div className="page-hero-icon">{cmsContent?.emoji || meta?.emoji || '📌'}</div>
          <h2 className="page-hero-title">{displayTitle}</h2>
          {displayDesc && <p className="page-hero-sub">{displayDesc}</p>}
        </div>
      </div>

      {/* Corpo */}
      <div className="guide-detail-body">
        {cmsContent === undefined ? (
          /* Scheletro di caricamento */
          <div className="guide-section-skeleton">
            <div className="skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ) : !hasPublishedContent ? (
          /* Fallback solo se non esiste un record pubblicato. */
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
        ) : (
          <>
            {cmsContent.videoUrl && (
              <section className="guide-detail-section">
                <p className="guide-media-label">{videoLabel}</p>
                <div className="content-video-wrap guide-detail-video-wrap">
                  <video className="content-video" controls playsInline preload="metadata">
                    <source src={cmsContent.videoUrl} />
                    Il tuo browser non supporta la riproduzione video.
                  </video>
                </div>
              </section>
            )}

            {cmsContent.audioUrl && (
              <section className="guide-detail-section">
                <p className="guide-media-label">{audioLabel}</p>
                <audio className="content-audio" controls preload="metadata">
                  <source src={cmsContent.audioUrl} />
                </audio>
              </section>
            )}

            {hasBody && (
              <section className="guide-detail-section">
                <h3 className="guide-content-heading">{textHeading}</h3>
                <div
                  className="guide-cms-body"
                  dangerouslySetInnerHTML={{ __html: cmsContent.body }}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
