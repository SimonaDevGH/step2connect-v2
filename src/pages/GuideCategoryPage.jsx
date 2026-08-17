import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryById, GUIDE_ITEMS } from '../data/guides';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function GuideCategoryPage() {
  const { category } = useParams();
  const { t, lang }  = useLanguage();
  const navigate     = useNavigate();

  const cat = getCategoryById(category);
  const [cmsItems, setCmsItems] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/content?type=guides&lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          // Filtra per categoria corrente
          const filtered = data.filter((item) => item.category === category);
          setCmsItems(filtered);
        }
      })
      .catch(() => setCmsItems([]));
    return () => { cancelled = true; };
  }, [category, lang]);

  if (!cat) {
    return <div className="page-content"><p className="empty-state">Categoria non trovata</p></div>;
  }

  const Icon = cat.icon;

  // Unisci: items statici arricchiti con CMS + nuovi items CMS non presenti negli statici
  const staticIds = cat.items || [];
  const cmsMap    = {};
  (cmsItems || []).forEach((item) => { cmsMap[item.id] = item; });

  // Items statici (nell'ordine originale, arricchiti con dati CMS se disponibili)
  const mergedItems = staticIds.map((id) => ({
    id,
    fromCms: !!cmsMap[id],
    title:   cmsMap[id]?.title || null, // null → usa i18n
    emoji:   cmsMap[id]?.emoji || GUIDE_ITEMS[id]?.emoji || '📌',
  }));

  // Nuovi items CMS non presenti nella lista statica
  const newCmsIds = Object.keys(cmsMap).filter((id) => !staticIds.includes(id));
  newCmsIds.forEach((id) => {
    mergedItems.push({
      id,
      fromCms: true,
      title:   cmsMap[id].title,
      emoji:   cmsMap[id].emoji || '📌',
    });
  });

  return (
    <div className="page-content">
      <div
        className={`page-hero${cat.heroImage ? ' page-hero--image' : ''}`}
        style={cat.heroImage ? {} : { background: cat.color }}
      >
        {cat.heroImage && <img src={cat.heroImage} alt="" className="page-hero-img" />}
        <div className="page-hero-overlay" style={cat.heroImage ? { background: 'rgba(10,30,58,0.08)' } : {}}>
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
        <div className="coming-soon-wrap">
          <span className="coming-soon-emoji">🛠️</span>
          <p className="coming-soon-title">{t('comingSoon')}</p>
          <p className="coming-soon-desc">{t('comingSoonDesc')}</p>
        </div>
      ) : (
        <div className="guide-items-list">
          {mergedItems.map(({ id, title, emoji }) => (
            <button
              key={id}
              className="guide-item-card"
              onClick={() => navigate(`/guides/${cat.id}/${id}`)}
              style={{ '--item-color': cat.color }}
            >
              <span className="guide-item-emoji">{emoji}</span>
              <div className="guide-item-text">
                <p className="guide-item-title">
                  {title || t(`guideItem_${id}_title`)}
                </p>
                <p className="guide-item-desc">
                  {t(`guideItem_${id}_desc`) || ''}
                </p>
              </div>
              <span className="guide-item-arrow">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
