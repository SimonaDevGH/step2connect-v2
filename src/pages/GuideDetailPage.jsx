import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';

export default function GuideDetailPage() {
  const { category, item } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const cat = getCategoryById(category);
  const meta = GUIDE_ITEMS[item];

  if (!cat || !meta) {
    return <div className="page-content"><p className="empty-state">Guida non trovata</p></div>;
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-hero" style={{ background: cat.color }}>
        <button className="back-btn" onClick={() => navigate(`/guides/${category}`)}>
          <ChevronLeft size={24} /> {t(`guideCat_${category}`)}
        </button>
        <div className="page-hero-icon">{meta.emoji}</div>
        <h2 className="page-hero-title">{t(`guideItem_${item}_title`)}</h2>
        <p className="page-hero-sub">{t(`guideItem_${item}_desc`)}</p>
      </div>

      {/* ── CONTENT PLACEHOLDER ────────────────────────────────────────────
          Replace the block below with the real migrated content.
          Suggested structure per guide:
            1. Intro paragraph
            2. Step-by-step numbered list
            3. Required documents checklist
            4. Useful contacts / links
      ─────────────────────────────────────────────────────────────────── */}
      <div className="guide-detail-body">
        <div className="guide-placeholder-block">
          <span className="guide-placeholder-icon">📝</span>
          <p className="guide-placeholder-text">{t('guideDetailPlaceholder')}</p>
        </div>

        {/* Skeleton sections — replace with real content */}
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
          <div className="skeleton-line" />
        </div>
      </div>
    </div>
  );
}
