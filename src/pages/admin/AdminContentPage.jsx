import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink, LogOut, RefreshCw, UserCircle } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useSections } from '../../context/SectionsContext';
import AdminContentList from './AdminContentList';
import AdminNotifications from './AdminNotifications';
import './admin-content.css';

const SECTION_NAV = [
  { slug: 'guide-pratiche', key: 'guides', title: 'Guide pratiche', path: '/guides', types: ['guides'] },
  { slug: 'quiz', key: 'quiz', title: 'Quiz', path: '/quiz', types: ['quiz'] },
  { slug: 'analizza-documento', key: 'analyze-document', title: 'Analizza documento', path: '/analyze-document' },
  { slug: 'notifiche', key: 'notifications', title: 'Notifiche', path: '/notifications' },
  { slug: 'news', key: 'news', title: 'News', path: '/news', types: ['news'] },
  { slug: 'traduttore', key: 'translator', title: 'Traduttore', path: '/translator' },
  { slug: 'trova-uffici', key: 'offices', title: 'Trova uffici', path: '/offices' },
  { slug: 'immagini-app', title: 'Immagini app', path: null, types: ['site'] },
  { slug: 'altro', title: 'Altro', path: null, types: ['library', 'pages'] },
];

const VISIBILITY = [
  { value: 'internal', label: 'Interno' },
  { value: 'preview', label: 'Anteprima' },
  { value: 'published', label: 'Pubblicato' },
];

function SectionVisibility({ section, sections, token, onSaved, onUnauthorized }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const current = sections?.[section.key]?.status || 'published';

  const updateStatus = async (status) => {
    if (busy || current === status) return;
    if (status === 'published' && !window.confirm(`Pubblicare la sezione “${section.title}”? Sarà visibile a tutti gli utenti.`)) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/sections/${section.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      await onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'Impossibile salvare lo stato.');
      if (String(err.message).includes('401') || String(err.message).toLowerCase().includes('token')) onUnauthorized?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cms-section-status">
      <div className="cms-status-pills" role="group" aria-label={`Visibilità: ${section.title}`}>
        {VISIBILITY.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className={`cms-status-pill cms-status-pill--${value}${current === value ? ' is-active' : ''}`}
            aria-pressed={current === value}
            disabled={busy}
            onClick={() => updateStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {busy && <span className="cms-save-state" role="status">Salvataggio…</span>}
      {saved && <span className="cms-save-state cms-save-state--success" role="status">Salvato</span>}
      {error && <span className="cms-save-state cms-save-state--error" role="alert">{error}</span>}
    </div>
  );
}

function SectionReadOnly({ section }) {
  return (
    <div className="cms-readonly-row">
      <span className="cms-readonly-mark" aria-hidden="true">↗</span>
      <div>
        <strong>{section.title}</strong>
        <span className="cms-readonly-path">— {section.path}</span>
      </div>
      <p>Pagina dell’app: si gestisce con lo stato della sezione qui sopra.</p>
    </div>
  );
}

export default function AdminContentPage() {
  const { section: sectionSlug } = useParams();
  const navigate = useNavigate();
  const { adminToken, adminUser, logout } = useAdminAuth();
  const { sections, sectionsReady, reloadSections } = useSections();
  const [refreshKey, setRefreshKey] = useState(0);
  const activeSection = SECTION_NAV.find((entry) => entry.slug === sectionSlug);

  useEffect(() => {
    if (!sectionSlug) navigate('/admin/content/guide-pratiche', { replace: true });
  }, [sectionSlug, navigate]);

  if (!sectionSlug) return <Navigate to="/admin/content/guide-pratiche" replace />;
  if (!activeSection) return <Navigate to="/admin/content/guide-pratiche" replace />;

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <main className="cms-admin page-content">
      <div className="cms-topbar">
        <button className="back-btn" onClick={() => navigate('/')}><ChevronLeft size={20} /> Home</button>
        <div className="cms-admin-identity">
          <span className="cms-admin-brand">Step2Connect <i>/</i> B4 CMS</span>
          <span className="cms-admin-user">{adminUser?.name || adminUser?.email || 'Admin'}</span>
        </div>
        <div className="cms-top-actions">
          <button className="cms-icon-action" onClick={() => navigate('/admin/account')} title="Il mio account" aria-label="Il mio account"><UserCircle size={18} /></button>
          <button
            className="cms-icon-action"
            onClick={() => { setRefreshKey((key) => key + 1); reloadSections(); }}
            title="Ricarica"
            aria-label="Ricarica"
          >
            <RefreshCw size={17} />
          </button>
          <button className="cms-icon-action cms-logout" onClick={handleLogout} title="Esci" aria-label="Esci"><LogOut size={17} /></button>
        </div>
      </div>

      <div className="cms-workspace">
        <nav className="cms-section-nav" aria-label="Sezioni CMS">
          {SECTION_NAV.map((entry) => {
            const status = entry.key ? sections?.[entry.key]?.status || 'published' : null;
            return (
              <Link
                key={entry.slug}
                to={`/admin/content/${entry.slug}`}
                className={`cms-section-tab${entry.slug === activeSection.slug ? ' is-active' : ''}`}
              >
                {status && <span className={`cms-section-dot cms-section-dot--${status}`} aria-label={status} />}
                <span>{entry.title}</span>
              </Link>
            );
          })}
        </nav>
        <div className="cms-main-column">
          <section className="cms-section-heading">
            <div className="cms-heading-main">
              <div>
                <p className="cms-eyebrow">Sezione</p>
                <h1>{activeSection.title}</h1>
              </div>
              {activeSection.path && (
                <a className="cms-open-app" href={activeSection.path} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Apri nell’app
                </a>
              )}
            </div>
            {activeSection.key && (
              <>
                <SectionVisibility
                  key={`${activeSection.key}-${sectionsReady}`}
                  section={activeSection}
                  sections={sections}
                  token={adminToken}
                  onSaved={reloadSections}
                  onUnauthorized={handleLogout}
                />
                <p className="cms-visibility-explainer">
                  <span><b>Interno</b> solo team B4</span>
                  <span><b>Anteprima</b> B4 + Fincantieri / ELIS</span>
                  <span><b>Pubblicato</b> tutti gli utenti</span>
                </p>
              </>
            )}
          </section>

          {activeSection.slug === 'altro' && (
            <section className="cms-section-heading" aria-label="Altre sezioni dell’app">
              <p className="cms-eyebrow">Altre sezioni dell’app</p>
              <p className="cms-visibility-explainer">Gestisci anche la visibilità di Libreria e Privacy, senza modificare file su S3.</p>
              {[
                { key: 'library', title: 'Libreria', path: '/library' },
                { key: 'privacy', title: 'Privacy', path: '/privacy' },
              ].map((section) => (
                <div key={section.key}>
                  <h2>{section.title}</h2>
                  <SectionVisibility section={section} sections={sections} token={adminToken}
                    onSaved={reloadSections} onUnauthorized={handleLogout} />
                  <a className="cms-open-app" href={section.path} target="_blank" rel="noreferrer">Apri nell’app</a>
                </div>
              ))}
            </section>
          )}
          {activeSection.key === 'notifications' ? (
            <AdminNotifications adminToken={adminToken} onUnauthorized={handleLogout} refreshKey={refreshKey} />
          ) : activeSection.types ? (
            <AdminContentList
              key={activeSection.slug}
              types={activeSection.types}
              adminToken={adminToken}
              onUnauthorized={handleLogout}
              refreshKey={refreshKey}
            />
          ) : (
            <SectionReadOnly section={activeSection} />
          )}
        </div>
      </div>
    </main>
  );
}
