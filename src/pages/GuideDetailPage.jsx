import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ArrowLeft, Target } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';
import { FEATURED_SERVICE_GUIDE_ID } from '../lib/guideOrdering';
import { useAuth } from '../context/AuthContext';
import { canSeeVisibility } from '../lib/sectionAccess';
import { quizApi, quizStars } from '../lib/quizApi';

// L'API pubblica è sullo stesso origin dell'app: in sviluppo Vite inoltra
// /api a Express e in produzione Express serve entrambe le parti.
const API = '';

export default function GuideDetailPage({ directCategory, directItem }) {
  const params = useParams();
  const category = directCategory || params.category;
  const item = directItem || params.item;
  const { t, lang }        = useLanguage();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { user } = useAuth();

  const cat  = getCategoryById(category);
  const meta = GUIDE_ITEMS[item];

  const [loadedContent, setCmsContent] = useState(undefined); // undefined = loading, null = not found
  const [linkedQuiz, setLinkedQuiz] = useState(null);
  const [quizProgress, setQuizProgress] = useState({});
  const cmsContent = loadedContent && !canSeeVisibility(loadedContent.visibility, user)
    ? null : loadedContent;
  const hasBody = Boolean(cmsContent?.body?.trim());

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

  useEffect(() => {
    let cancelled = false;
    setLinkedQuiz(null);
    quizApi(`/api/quiz?lang=${lang}`)
      .then((data) => {
        if (cancelled) return;
        const found = (data.items || []).find((quiz) => (
          (quiz.guideId === item || quiz.guideUrl === window.location.pathname)
          && canSeeVisibility(quiz.visibility, user)
        ));
        setLinkedQuiz(found || null);
        setQuizProgress(data.quizResults || {});
      })
      .catch(() => { if (!cancelled) { setLinkedQuiz(null); setQuizProgress({}); } });
    return () => { cancelled = true; };
  }, [item, lang, user]);

  useEffect(() => {
    if (!hasBody || !cmsContent) return undefined;
    const body = document.querySelector('.guide-cms-body');
    if (!body) return undefined;
    const children = Array.from(body.children);
    children.forEach((child, index) => { child.id = `p${index + 1}`; });
    const anchor = window.location.hash.slice(1);
    if (!/^p\d+$/.test(anchor)) return undefined;
    const target = document.getElementById(anchor);
    if (!target) return undefined;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('guide-anchor-highlight');
      window.setTimeout(() => {
        target.classList.remove('guide-anchor-highlight');
      }, 2000);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [hasBody, cmsContent, location.hash]);

  if (!cat) {
    return <div className="page-content"><p className="empty-state">Guida non trovata</p></div>;
  }

  // Il CMS può contenere nuove guide non presenti nel catalogo statico.
  const displayTitle = cmsContent?.title || (meta ? t(`guideItem_${item}_title`) : t('guidesTitle'));
  const displayDesc  = cmsContent?.metaDesc || (meta ? t(`guideItem_${item}_desc`) : '');
  const hasPublishedContent = cmsContent !== undefined && cmsContent !== null;
  const hasCoverImage = Boolean(cmsContent?.imageUrl);
  const isFeaturedServiceGuide = item === FEATURED_SERVICE_GUIDE_ID;
  const backPath = isFeaturedServiceGuide ? '/guides' : `/guides/${category}`;
  const backLabel = isFeaturedServiceGuide ? t('guidesTitle') : t(`guideCat_${category}`);
  const isResidencePermitGuide =
    item === 'permitRequest' ||
    /permesso di soggiorno|residence permit|বাসস্থান পারমিট/i.test(displayTitle);
  const videoLabel = isResidencePermitGuide
    ? t('guidePermitVideoPrompt')
    : t('guideVideoPrompt');
  const audioLabel = isResidencePermitGuide
    ? t('guidePermitAudioPrompt')
    : t('guideAudioPrompt');

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
          <button className="back-btn" onClick={() => navigate(backPath)}>
            <ChevronLeft size={24} /> {backLabel}
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
                <div
                  className="guide-cms-body"
                  dangerouslySetInnerHTML={{ __html: cmsContent.body }}
                />
              </section>
            )}
            {linkedQuiz && canSeeVisibility(linkedQuiz.visibility, user) && (
              <button type="button" className="guide-quiz-card" onClick={() => navigate(`/quiz/${encodeURIComponent(linkedQuiz.id)}`)}>
                <span className="guide-quiz-card-icon"><Target size={23}/></span>
                <span className="guide-quiz-card-copy"><strong>{t('quizTryIt')}</strong><small>{linkedQuiz.questions?.length || 0} {t('quizQuestions')} · {t('quizMinute')}</small></span>
                <span className="guide-quiz-card-stars" aria-label={`${quizStars(quizProgress[linkedQuiz.id]?.bestScore, linkedQuiz.questions?.length)} ${t('quizStars')}`}>{[1,2,3].map((star) => <i key={star} className={star <= quizStars(quizProgress[linkedQuiz.id]?.bestScore, linkedQuiz.questions?.length) ? 'earned' : ''}>★</i>)}</span>
                <ChevronLeft className="guide-quiz-arrow" size={19}/>
              </button>
            )}
          </>
        )}
      </div>
      {location.state?.fromQuiz && location.state?.returnPath && /^#p\d+$/.test(location.hash) && (
        <button className="guide-quiz-return" onClick={() => navigate(location.state.returnPath)}><ArrowLeft size={18}/>{t('quizReturn')}</button>
      )}
    </div>
  );
}
