import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, Languages, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { GUIDE_CATEGORIES } from '../data/guides';
import { useSections } from '../context/SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';
import FeaturedGuideCard from '../components/FeaturedGuideCard';
import AskMeButton from '../components/AskMeButton';
import useFeaturedGuide from '../lib/useFeaturedGuide';

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { user, profileReady } = useAuth();
  const { sections, sectionsReady } = useSections();
  const siteImages = useSiteImages();
  const navigate = useNavigate();
  const location = useLocation();
  const { featuredGuide } = useFeaturedGuide();
  const visibleSection = (key) => profileReady && sectionsReady && canSeeSection(key, user, sections);
  const lpPlaceholderRef = useRef(null);

  useEffect(() => {
    const container = document.getElementById('LP_DIV_1785257734021');
    const placeholder = lpPlaceholderRef.current;
    if (!container || !placeholder) return;
    const observer = new MutationObserver(() => {
      if (container.hasChildNodes()) {
        placeholder.style.visibility = 'hidden';
        observer.disconnect();
      }
    });
    if (container.hasChildNodes()) placeholder.style.visibility = 'hidden';
    else observer.observe(container, { childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!location.state?.scrollToAskMe) return;
    window.requestAnimationFrame(() => {
      document.getElementById('ask-me')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate('/home', { replace: true, state: null });
  }, [location.state, navigate]);

  return (
    <div className="page-content home-page">
      {/* Hero */}
      <section className="hero">
        <img src={siteImages.homeHero} alt="" className="hero-img" />
        <div className="hero-overlay">
          <div className={`hero-text-block lang-${lang}`}>
            <h2 className="hero-title">
              {t('heroTitle')}{user?.firstName ? `, ${user.firstName}` : ''}
            </h2>
            <p className="hero-subtitle">{t('heroSubtitle')}</p>
          </div>
        </div>
      </section>

      {/* Access to the dedicated service pages and Ask Me */}
      <section className="quick-actions" aria-label={t('quickActions')}>
        {visibleSection('analyze-document') ? (
          <Link className="quick-action" to="/analyze-document">
            <span className="quick-action-icon quick-action-analyze"><Sparkles size={25} /></span>
            <span className="quick-action-label">{t('analyzeTitle')}</span>
          </Link>
        ) : <span className="quick-action-placeholder" aria-hidden="true" />}
        <AskMeButton className="quick-action quick-action-ask" icon={Bot} />
        {visibleSection('translator') ? (
          <Link className="quick-action" to="/translator">
            <span className="quick-action-icon quick-action-translate"><Languages size={25} /></span>
            <span className="quick-action-label">{t('translate')}</span>
          </Link>
        ) : <span className="quick-action-placeholder" aria-hidden="true" />}
      </section>

      {/* All guides */}
      {visibleSection('guides') && <section className="home-guides-section">
        <div className="home-section-heading">
          <h3 className="section-title">{t('guidesTitle')}</h3>
          <button type="button" className="see-all-guides" onClick={() => navigate('/guides')}>{t('seeAllGuides')} <span aria-hidden="true">›</span></button>
        </div>
        <FeaturedGuideCard featuredGuide={featuredGuide} />
        <div className="guides-grid home-guide-grid">
          {GUIDE_CATEGORIES.map(({ id, icon: Icon, color }) => (
            <button
              key={id}
              className={`guide-cat-card${id === 'cityLife' ? ' guide-cat-card-wide' : ''}`}
              onClick={() => navigate(`/guides/${id}`)}
              style={{ '--cat-color': color }}
            >
              <div className="guide-cat-icon-wrap"><Icon size={30} color={color} /></div>
              <p className="guide-cat-name">{t(`guideCat_${id}`)}</p>
              <p className="guide-cat-desc">{t(`guideCat_${id}Desc`)}</p>
              <span className="guide-cat-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>}

      {/* Ask Me */}
      <section id="ask-me" className="assistant-section">
        <div className="assistant-header">
          <div className="assistant-icon-wrap"><Bot size={24} color="#ffffff" /></div>
          <h3 className="section-title" style={{ margin: 0 }}>{t('botTitle')}</h3>
        </div>
        <p className="assistant-desc">{t('botDesc')}</p>
        <div className="lp-engagement-slot">
          <div className="lp-placeholder" ref={lpPlaceholderRef} aria-hidden="true">
            <div>Chiedimi qualsiasi cosa — sono qui per aiutarti</div>
            <div>-</div>
            <div>Ask me anything — I’m here to help you</div>
            <div>-</div>
            <div>আমাকে যেকোনো কিছু জিজ্ঞাসা করুন — আমি আপনাকে সাহায্য করতে এখানে আছি।</div>
          </div>
          <div id="LP_DIV_1785257734021" className="lp-engagement-container"></div>
        </div>
      </section>

    </div>
  );
}
