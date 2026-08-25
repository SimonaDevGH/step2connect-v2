/**
 * PageResolver — catch-all per le pagine CMS (tipo "pages").
 * Prova a risolvere il pathname corrente contro /api/content/pages-by-url.
 * Se trovato → mostra il contenuto con title + meta description + body.
 * Se non trovato → redirect a /home.
 */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function PageResolver() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang }  = useLanguage();

  const [page,    setPage]    = useState(null);    // contenuto CMS
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = location.pathname;

    fetch(`${API}/api/content/pages-by-url?url=${encodeURIComponent(url)}&lang=${lang}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
        } else {
          setPage(data);
          // SEO: imposta title e meta description
          document.title = data.title || document.title;
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'description');
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', data.metaDesc || '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setNotFound(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [location.pathname, lang]);

  // Redirect se non trovato
  useEffect(() => {
    if (notFound) navigate('/home', { replace: true });
  }, [notFound, navigate]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="admin-loading">Caricamento…</div>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="page-content">
      {/* Hero */}
      {page.imageUrl ? (
        <div className="page-hero page-hero--image">
          <img src={page.imageUrl} alt={page.title} className="page-hero-img" />
          <div className="page-hero-overlay">
            <h2 className="page-hero-title">{page.title}</h2>
          </div>
        </div>
      ) : (
        <div className="page-hero" style={{ background: '#1D3557' }}>
          <div className="page-hero-icon">{page.emoji || '📄'}</div>
          <h2 className="page-hero-title">{page.title}</h2>
        </div>
      )}

      {page.videoUrl && (
        <div className="content-video-wrap">
          <video className="content-video" controls playsInline preload="metadata">
            <source src={page.videoUrl} />
            Il tuo browser non supporta la riproduzione video.
          </video>
        </div>
      )}

      {/* Corpo */}
      <div
        className="guide-detail-body guide-cms-body"
        dangerouslySetInnerHTML={{ __html: page.body || '' }}
      />
    </div>
  );
}
