import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CONTENT_TYPES = {
  news: {
    backPath: '/news',
    titleKey: 'newsTitle',
    color: '#1D3557',
    emoji: '📰',
  },
  library: {
    backPath: '/library',
    titleKey: 'libraryTitle',
    color: '#06A77D',
    emoji: '📚',
  },
};

/**
 * Dettaglio pubblico per news e library. Mostra esclusivamente il JSON
 * pubblicato relativo alla lingua attiva; il placeholder appare solo se manca.
 */
export default function ContentDetailPage({ contentType }) {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const config = CONTENT_TYPES[contentType];
  const [content, setContent] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    setContent(undefined);

    fetch(`/api/content/${contentType}/${encodeURIComponent(id)}?lang=${lang}`)
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setContent(data || null);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      });

    return () => { cancelled = true; };
  }, [contentType, id, lang]);

  if (!config) return null;

  const title = content?.title || t(config.titleKey);
  const hasBody = Boolean(content?.body?.trim());

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: config.color }}>
        <button className="back-btn" onClick={() => navigate(config.backPath)}>
          <ChevronLeft size={24} /> {t(config.titleKey)}
        </button>
        <div className="page-hero-icon">{content?.emoji || config.emoji}</div>
        <h2 className="page-hero-title">{title}</h2>
        {content?.metaDesc && <p className="page-hero-sub">{content.metaDesc}</p>}
      </div>

      {content?.imageUrl && (
        <img className="content-detail-image" src={content.imageUrl} alt={title} />
      )}

      {content?.videoUrl && (
        <div className="content-video-wrap">
          <video className="content-video" controls playsInline preload="metadata">
            <source src={content.videoUrl} />
            Il tuo browser non supporta la riproduzione video.
          </video>
        </div>
      )}

      <div className="guide-detail-body">
        {content === undefined ? (
          <div className="guide-section-skeleton">
            <div className="skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ) : content === null ? (
          <div className="guide-placeholder-block">
            <span className="guide-placeholder-icon">📝</span>
            <p className="guide-placeholder-text">{t('contentDetailPlaceholder')}</p>
          </div>
        ) : (
          <>
            {hasBody && (
              <div className="guide-cms-body" dangerouslySetInnerHTML={{ __html: content.body }} />
            )}
            {content.audioUrl && (
              <audio className="content-audio" controls preload="metadata">
                <source src={content.audioUrl} />
              </audio>
            )}
          </>
        )}
      </div>
    </div>
  );
}