import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Send, Upload, Music, Video } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  SITE_IMAGES_ID,
  SITE_IMAGE_GROUPS,
  SITE_IMAGE_SLOTS,
} from '../../lib/siteImages';

// Route admin: URL sempre relativi (proxy Vite in dev, Express stesso origin in prod).
const API = '';
const LANGS = [
  { code: 'it', label: 'Italiano 🇮🇹' },
  { code: 'en', label: 'English 🇬🇧' },
  { code: 'bn', label: 'বাংলা 🇧🇩' },
];
const TYPES = ['guides', 'news', 'library', 'pages', 'site'];
const MEDIA_UPLOAD_LIMIT_MB = { img: 5, audio: 25, video: 100 };

const GUIDE_CATEGORIES = [
  { value: 'guides',    label: '📖 Guide pratiche — pagina principale' },
  { value: 'documents', label: '📄 Documenti e permessi' },
  { value: 'health',    label: '❤️ Salute' },
  { value: 'homeBills', label: '🏠 Casa e bollette' },
  { value: 'school',    label: '🎓 Scuola e famiglia' },
  { value: 'cityLife',  label: '🏙️ Vita in città' },
  { value: 'work',      label: '💼 Lavoro' },
];

async function apiFetch(path, token, opts = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }
  return data;
}

const emptyLang = (type = 'guides') => ({
  title: type === 'site' ? 'Immagini applicazione' : '',
  body: '',
  audioUrl: '',
  videoUrl: '',
  metaDesc: '',
  emoji: type === 'site' ? '🖼️' : '📄',
  imageUrl: '',
  assets: {},
});
const defaultForm = (type = 'guides') => ({
  id: type === 'site' ? SITE_IMAGES_ID : '',
  type,
  category: '',
  sortOrder: '',
  url: '',
  it: emptyLang(type),
  en: emptyLang(type),
  bn: emptyLang(type),
});

const LANGUAGE_NAMES = { it: 'italiano', en: 'inglese', bn: 'bengalese' };

function validationIssueMessage(issue) {
  const path = Array.isArray(issue.path) ? issue.path : [];
    const [section, field] = path;
  const language = LANGUAGE_NAMES[section];

  if (section === 'id') {
    if (issue.code === 'too_small') return 'Inserisci un ID univoco.';
    if (issue.validation === 'regex' || issue.format === 'regex' || issue.code === 'invalid_format') {
      return 'L’ID può contenere solo lettere, numeri, trattini (-) e underscore (_).';
    }
    if (issue.code === 'too_big') return 'L’ID non può superare 100 caratteri.';
    return 'Controlla l’ID inserito.';
  }
  if (section === 'type') return 'Seleziona un tipo di contenuto valido.';
  if (section === 'category' && issue.code === 'too_big') {
    return 'La categoria non può superare 100 caratteri.';
  }
  if (section === 'sortOrder') {
    return 'L’ordine deve essere un numero intero uguale o superiore a 1.';
  }
  if (section === 'url') {
    if (issue.message?.includes('obbligatorio')) return 'Per le pagine CMS l’URL pubblico è obbligatorio.';
    if (issue.message?.includes('iniziare')) return 'L’URL pubblico deve iniziare con /.';
    if (issue.code === 'too_big') return 'L’URL pubblico non può superare 500 caratteri.';
    return 'Controlla l’URL pubblico inserito.';
  }

  if (language) {
    if (!field) return `Compila la sezione in ${language}.`;
    if (field === 'title') {
      if (issue.code === 'too_small') return `Il titolo in ${language} è obbligatorio.`;
      if (issue.code === 'too_big') return `Il titolo in ${language} non può superare 500 caratteri.`;
      return `Controlla il titolo in ${language}.`;
    }
    if (field === 'body' && issue.code === 'too_big') {
      return `Il testo in ${language} non può superare 50.000 caratteri.`;
    }
    if (field === 'metaDesc' && issue.code === 'too_big') {
      return `La meta description in ${language} non può superare 300 caratteri.`;
    }
    if (['audioUrl', 'videoUrl', 'imageUrl'].includes(field)) {
      const labels = { audioUrl: 'audio', videoUrl: 'video', imageUrl: 'immagine' };
      return `L’URL ${labels[field]} in ${language} non è valido. Usa un indirizzo completo che inizi con http:// o https://.`;
    }
    if (field === 'assets') {
      return `L’URL dell’immagine in ${language} non è valido. Usa un indirizzo completo che inizi con http:// o https://.`;
    }
    if (field === 'emoji' && issue.code === 'too_big') {
      return `L’icona in ${language} non può superare 10 caratteri.`;
    }
    return `Controlla il campo ${field} in ${language}.`;
  }

  return issue.message || 'Controlla i dati inseriti.';
}

function getValidationError(error) {
  if (!Array.isArray(error?.details) || error.details.length === 0) return null;

  const fieldErrors = {};
  error.details.forEach((issue) => {
    const path = Array.isArray(issue.path) ? issue.path.join('.') : '';
    if (path && !fieldErrors[path]) fieldErrors[path] = validationIssueMessage(issue);
  });
  const messages = [...new Set(error.details.map(validationIssueMessage))];
  return {
    summary: messages.length === 1
      ? 'Impossibile salvare il contenuto. Correggi il problema indicato:'
      : 'Impossibile salvare il contenuto. Correggi i problemi indicati:',
    fieldErrors,
    messages,
  };
}

function FieldError({ fieldErrors, path }) {
  const message = fieldErrors[path];
  return message ? <div className="admin-field-error" role="alert">{message}</div> : null;
}

export default function ContentEditForm({ contentType, contentId, onClose }) {
  const isNew = !contentId;
  const { adminToken, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [form,         setForm]         = useState(() => defaultForm(contentType || 'guides'));
  // Mantiene l'ID dell'ultimo draft salvato: dopo una rinomina il successivo
  // "Pubblica" deve puntare alla nuova chiave S3, non a quella precedente.
  const [savedId,      setSavedId]      = useState(contentId || '');
  const [loading,      setLoading]      = useState(!isNew);
  const [saving,       setSaving]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [error,        setError]        = useState('');
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [success,      setSuccess]      = useState('');
  const [uploadingMedia, setUploadingMedia] = useState('');

  const handleAuthError = (err) => {
    if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
      logout();
      navigate('/admin/login', { replace: true });
    }
  };

  // Carica contenuto esistente
  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const data = await apiFetch(`/api/admin/content/${contentType}/${contentId}`, adminToken);
        setForm((prev) => ({ ...prev, ...data }));
      } catch (err) {
        handleAuthError(err);
        setError('Errore caricamento: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [contentId, contentType, isNew, adminToken]);

  const clearFieldError = (path) => {
    setFieldErrors((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const setBaseField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const setLangField = (lang, field, value) => {
    setForm((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));
    clearFieldError(`${lang}.${field}`);
  };

  const setLangAsset = (lang, asset, value) => {
    setForm((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        assets: {
          ...(prev[lang]?.assets || {}),
          [asset]: value,
        },
      },
    }));
    clearFieldError(`${lang}.assets.${asset}`);
  };

  const showRequestError = (err, fallback) => {
    handleAuthError(err);
    const validation = getValidationError(err);
    if (validation) {
      setError(validation.summary);
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    setError(err.message || fallback);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    setFieldErrors({});
    setSuccess('');
    try {
      const requestId = savedId || form.id;
      const saved = await apiFetch(`/api/admin/content/${form.type}/${requestId}`, adminToken, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm((prev) => ({ ...prev, id: saved.id || prev.id, url: saved.url ?? prev.url }));
      setSavedId(saved.id || form.id);
      setSuccess('Bozza salvata ✓');
    } catch (err) {
      showRequestError(err, 'Errore durante il salvataggio della bozza.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Pubblicare? Il contenuto sarà visibile a tutti gli utenti.')) return;
    setPublishing(true);
    setError('');
    setFieldErrors({});
    setSuccess('');
    try {
      const requestId = savedId || form.id;
      const saved = await apiFetch(`/api/admin/content/${form.type}/${requestId}`, adminToken, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const publishedId = saved.id || form.id;
      setForm((prev) => ({ ...prev, id: publishedId, url: saved.url ?? prev.url }));
      setSavedId(publishedId);
      await apiFetch(`/api/admin/content/${form.type}/${publishedId}/publish`, adminToken, { method: 'POST' });
      setSuccess('Pubblicato! ✓');
    } catch (err) {
      showRequestError(err, 'Errore durante la pubblicazione.');
    } finally {
      setPublishing(false);
    }
  };

  const handleMediaUpload = async (lang, kind, e, asset = '') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MEDIA_UPLOAD_LIMIT_MB[kind] * 1024 * 1024) {
      setError(`File troppo grande: il limite per ${kind} è ${MEDIA_UPLOAD_LIMIT_MB[kind]} MB.`);
      e.target.value = '';
      return;
    }
    const uploadKey = asset ? `${lang}:${asset}` : `${lang}:${kind}`;
    setUploadingMedia(uploadKey);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadParams = new URLSearchParams({ lang, mediaType: kind });
      if (asset) uploadParams.set('slot', asset);
      const data = await apiFetch(
        `/api/admin/content/${form.type}/${form.id || 'new'}/media?${uploadParams}`,
        adminToken,
        { method: 'POST', body: fd }
      );
      if (asset) setLangAsset(lang, asset, data.url);
      else setLangField(lang, { img: 'imageUrl', audio: 'audioUrl', video: 'videoUrl' }[kind], data.url);
      setSuccess('File caricato. Salva la bozza o pubblica per collegarlo al contenuto.');
    } catch (err) {
      handleAuthError(err);
      setError('Upload fallito: ' + err.message);
    } finally {
      e.target.value = '';
      setUploadingMedia('');
    }
  };

  if (loading) return <div className="admin-loading">Caricamento…</div>;

  const isPages    = form.type === 'pages';
  const isGuides   = form.type === 'guides';
  const isSite     = form.type === 'site';
  const guidePath  = isGuides && form.category && form.id
    ? (form.category === 'guides'
      ? `/guides/${form.id}`
      : `/guides/${form.category}/${form.id}`)
    : '';

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#1D3557' }}>
        <button className="back-btn" onClick={onClose}>
          <ChevronLeft size={24} /> Lista
        </button>
        <div className="page-hero-icon">✏️</div>
        <h2 className="page-hero-title">{isNew ? 'Nuovo contenuto' : `Modifica: ${contentId}`}</h2>
      </div>

      <div className="admin-form">
        {error && (
          <div className="admin-error" role="alert">
            <strong>{error}</strong>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="admin-error-list">
                {Object.entries(fieldErrors).map(([path, message]) => (
                  <li key={path}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {success && <div className="admin-success">✓ {success}</div>}

        {/* Metadati base */}
        {!isSite ? (
        <div className="admin-section">
          <label className="admin-label">{isGuides ? 'Nome pagina / ID *' : 'ID univoco *'}</label>
          <input
            className={`admin-input${fieldErrors.id ? ' admin-input--error' : ''}`}
            value={form.id}
            onChange={(e) => setBaseField('id', e.target.value)}
            placeholder={isGuides ? 'es. permesso-di-soggiorno' : 'es. news-001'}
            aria-invalid={Boolean(fieldErrors.id)}
          />
          <FieldError fieldErrors={fieldErrors} path="id" />
          {isGuides && (
            <>
              <label className="admin-label">URL pubblico della guida</label>
              <div className="admin-public-url">{guidePath || 'Scegli prima categoria e nome pagina'}</div>
              <p className="admin-hint">
                Modifica “Nome pagina / ID” per cambiare l’ultima parte dell’URL. Al momento della pubblicazione il vecchio URL verrà disattivato.
              </p>
            </>
          )}

          <label className="admin-label">Tipo *</label>
          <select
            className="admin-input"
            value={form.type}
            onChange={(e) => setBaseField('type', e.target.value)}
          >
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>

          {/* Categoria: dropdown per guides, testo libero per gli altri */}
          <label className="admin-label">Categoria</label>
          {isGuides ? (
            <select
              className={`admin-input${fieldErrors.category ? ' admin-input--error' : ''}`}
              value={form.category}
              onChange={(e) => setBaseField('category', e.target.value)}
            >
              <option value="">— seleziona categoria —</option>
              {GUIDE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <input
                className={`admin-input${fieldErrors.category ? ' admin-input--error' : ''}`}
              value={form.category}
                onChange={(e) => setBaseField('category', e.target.value)}
              placeholder="es. documents"
            />
          )}
          <FieldError fieldErrors={fieldErrors} path="category" />

          {isGuides && (
            <>
              <label className="admin-label">Ordine nella categoria</label>
              <input
                className={`admin-input${fieldErrors.sortOrder ? ' admin-input--error' : ''}`}
                type="number"
                min="1"
                step="1"
                value={form.sortOrder ?? ''}
                onChange={(e) => setBaseField('sortOrder', e.target.value)}
                placeholder="es. 1"
                aria-invalid={Boolean(fieldErrors.sortOrder)}
              />
              <p className="admin-hint">
                Inserisci 1 per il primo contenuto, 2 per il secondo e così via.
                I contenuti senza numero vengono mostrati dopo quelli ordinati.
              </p>
              <FieldError fieldErrors={fieldErrors} path="sortOrder" />
            </>
          )}

          {/* URL libero per le pagine CMS. Per le guide viene sempre calcolato da categoria + ID. */}
          {isPages && (
            <>
              <label className="admin-label" style={{ color: '#c0392b' }}>
                URL pagina * <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>
                  (es. /guide-pratiche/documenti/permesso-di-soggiorno)
                </span>
              </label>
              <input
                className={`admin-input${fieldErrors.url ? ' admin-input--error' : ''}`}
                value={form.url}
                onChange={(e) => setBaseField('url', e.target.value)}
                placeholder="/percorso/pubblico/della-pagina"
                aria-invalid={Boolean(fieldErrors.url)}
              />
              <FieldError fieldErrors={fieldErrors} path="url" />
            </>
          )}
        </div>
        ) : (
          <div className="admin-section">
            <h3 style={{ marginTop: 0 }}>Immagini generali della webApp</h3>
            <p className="admin-hint">
              Questa sezione controlla le immagini delle pagine che non hanno un
              contenuto CMS dedicato. Le modifiche diventano visibili solo dopo
              la pubblicazione.
            </p>
          </div>
        )}

        <p className="admin-language-intro">
          {isSite
            ? 'Carica le immagini separatamente per italiano, inglese e bengalese. Se un campo resta vuoto, la webApp usa automaticamente l’immagine predefinita attuale.'
            : 'Compila ogni lingua separatamente. Titolo, testo, media, immagine e icona vengono salvati solo nella rispettiva versione. I titoli contrassegnati con * sono obbligatori in italiano, inglese e bengalese.'}
        </p>

        {isSite && (
          <nav className="admin-site-jump-menu" aria-label="Vai alla sezione immagini">
            <label htmlFor="site-image-section">Vai alla sezione</label>
            <select
              id="site-image-section"
              defaultValue=""
              onChange={(event) => {
                const target = document.getElementById(event.target.value);
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                event.target.value = '';
              }}
            >
              <option value="" disabled>Scegli lingua e pagina…</option>
              {LANGS.flatMap(({ code, label }) =>
                SITE_IMAGE_GROUPS.map((group) => (
                  <option
                    key={`${code}-${group.key}`}
                    value={`site-images-${code}-${group.key}`}
                  >
                    {label} — {group.label}
                  </option>
                ))
              )}
            </select>
          </nav>
        )}

        {LANGS.map(({ code, label }) => {
          const language = form[code];
          return (
            <section className="admin-language-section" key={code}>
              <h3 className="admin-language-heading">{label}</h3>

              {isSite ? (
                <div className="admin-site-images">
                  {SITE_IMAGE_GROUPS.map((group) => (
                    <section
                      id={`site-images-${code}-${group.key}`}
                      className="admin-site-image-group"
                      key={group.key}
                    >
                      <h4>{group.label}</h4>
                      {SITE_IMAGE_SLOTS.filter((slot) => slot.group === group.key).map((slot) => {
                    const value = language.assets?.[slot.key] || '';
                    const uploadKey = `${code}:${slot.key}`;
                    return (
                      <div className="admin-site-image-field" key={slot.key}>
                        <label className="admin-label">{slot.label}</label>
                        {value && (
                          <img
                            src={value}
                            alt={`Anteprima ${slot.label} — ${label}`}
                            className="admin-img-preview"
                          />
                        )}
                        <div className="admin-site-image-actions">
                          <label className="admin-upload-btn">
                            {uploadingMedia === uploadKey
                              ? 'Caricamento…'
                              : <><Upload size={16} /> Carica / sostituisci</>}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={(e) => handleMediaUpload(code, 'img', e, slot.key)}
                              style={{ display: 'none' }}
                              disabled={Boolean(uploadingMedia)}
                            />
                          </label>
                          {value && (
                            <button
                              type="button"
                              className="admin-refresh-btn"
                              onClick={() => setLangAsset(code, slot.key, '')}
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                        <input
                          className={`admin-input${fieldErrors[`${code}.assets.${slot.key}`] ? ' admin-input--error' : ''}`}
                          type="url"
                          value={value}
                          onChange={(e) => setLangAsset(code, slot.key, e.target.value)}
                          placeholder={`URL immagine; fallback: ${slot.fallback}`}
                          aria-invalid={Boolean(fieldErrors[`${code}.assets.${slot.key}`])}
                        />
                        <FieldError fieldErrors={fieldErrors} path={`${code}.assets.${slot.key}`} />
                      </div>
                    );
                      })}
                    </section>
                  ))}
                </div>
              ) : (
                <>
              <label className="admin-label">Titolo ({code.toUpperCase()}) *</label>
              <input
                className={`admin-input${fieldErrors[`${code}.title`] ? ' admin-input--error' : ''}`}
                value={language.title}
                onChange={(e) => setLangField(code, 'title', e.target.value)}
                placeholder="Titolo"
                aria-invalid={Boolean(fieldErrors[`${code}.title`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.title`} />

              {isPages ? (
                <>
                  <label className="admin-label" style={{ color: '#c0392b' }}>
                    Meta description ({code.toUpperCase()}) — SEO
                    <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                      max 300 caratteri
                    </span>
                  </label>
                  <textarea
                    className={`admin-textarea admin-meta-textarea${fieldErrors[`${code}.metaDesc`] ? ' admin-input--error' : ''}`}
                    value={language.metaDesc}
                    onChange={(e) => setLangField(code, 'metaDesc', e.target.value)}
                    placeholder="Breve descrizione per i motori di ricerca e le anteprime social"
                    rows={2}
                    maxLength={300}
                    aria-invalid={Boolean(fieldErrors[`${code}.metaDesc`])}
                  />
                  <FieldError fieldErrors={fieldErrors} path={`${code}.metaDesc`} />
                </>
              ) : (
                <>
                  <label className="admin-label">
                    Meta description ({code.toUpperCase()})
                    <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                      opzionale, max 300 car.
                    </span>
                  </label>
                  <input
                    className={`admin-input${fieldErrors[`${code}.metaDesc`] ? ' admin-input--error' : ''}`}
                    value={language.metaDesc}
                    onChange={(e) => setLangField(code, 'metaDesc', e.target.value)}
                    placeholder="Descrizione breve (opzionale)"
                    maxLength={300}
                    aria-invalid={Boolean(fieldErrors[`${code}.metaDesc`])}
                  />
                  <FieldError fieldErrors={fieldErrors} path={`${code}.metaDesc`} />
                </>
              )}

              <label className="admin-label">
                Testo / Corpo ({code.toUpperCase()})
                {isPages && (
                  <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                    HTML: b, i, ul, ol, li, p, br, a, h2, h3, img
                  </span>
                )}
              </label>
              <textarea
                className={`admin-textarea${fieldErrors[`${code}.body`] ? ' admin-input--error' : ''}`}
                value={language.body}
                onChange={(e) => setLangField(code, 'body', e.target.value)}
                placeholder={
                  isPages
                    ? 'Corpo della pagina — HTML consentito incluso <img src="..." alt="...">'
                    : 'Testo del contenuto (HTML: b, i, ul, ol, li, p, br, a, h2, h3)'
                }
                rows={10}
                aria-invalid={Boolean(fieldErrors[`${code}.body`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.body`} />

              <label className="admin-label">
                <Music size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Audio ({code.toUpperCase()}) — opzionale
              </label>
              <label className="admin-upload-btn">
                {uploadingMedia === `${code}:audio` ? 'Caricamento audio…' : <><Upload size={16} /> Carica audio {code.toUpperCase()}</>}
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                  onChange={(e) => handleMediaUpload(code, 'audio', e)}
                  style={{ display: 'none' }}
                  disabled={Boolean(uploadingMedia) || !form.id}
                />
              </label>
              {language.audioUrl && <audio controls preload="none" src={language.audioUrl} className="admin-media-preview" />}
              <input
                className={`admin-input${fieldErrors[`${code}.audioUrl`] ? ' admin-input--error' : ''}`}
                type="url"
                value={language.audioUrl}
                onChange={(e) => setLangField(code, 'audioUrl', e.target.value)}
                placeholder="URL audio (oppure carica un file, max 25 MB)"
                aria-invalid={Boolean(fieldErrors[`${code}.audioUrl`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.audioUrl`} />

              <label className="admin-label">
                <Video size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Video ({code.toUpperCase()}) — opzionale
              </label>
              <label className="admin-upload-btn">
                {uploadingMedia === `${code}:video` ? 'Caricamento video…' : <><Upload size={16} /> Carica video {code.toUpperCase()}</>}
                <input
                  type="file"
                  accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleMediaUpload(code, 'video', e)}
                  style={{ display: 'none' }}
                  disabled={Boolean(uploadingMedia) || !form.id}
                />
              </label>
              {language.videoUrl && <video controls preload="none" src={language.videoUrl} className="admin-media-preview" />}
              <input
                className={`admin-input${fieldErrors[`${code}.videoUrl`] ? ' admin-input--error' : ''}`}
                type="url"
                value={language.videoUrl}
                onChange={(e) => setLangField(code, 'videoUrl', e.target.value)}
                placeholder="URL video (oppure carica un file, max 100 MB)"
                aria-invalid={Boolean(fieldErrors[`${code}.videoUrl`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.videoUrl`} />

              <label className="admin-label">Icona ({code.toUpperCase()})</label>
              <input
                className={`admin-input admin-emoji-input${fieldErrors[`${code}.emoji`] ? ' admin-input--error' : ''}`}
                value={language.emoji}
                onChange={(e) => setLangField(code, 'emoji', e.target.value)}
                placeholder="📄"
                maxLength={10}
                aria-invalid={Boolean(fieldErrors[`${code}.emoji`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.emoji`} />

              <label className="admin-label">Immagine copertina ({code.toUpperCase()})</label>
              {language.imageUrl && (
                <img src={language.imageUrl} alt={`Anteprima ${label}`} className="admin-img-preview" />
              )}
              <label className="admin-upload-btn">
                {uploadingMedia === `${code}:img` ? 'Caricamento…' : <><Upload size={16} /> Carica immagine {code.toUpperCase()}</>}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleMediaUpload(code, 'img', e)}
                  style={{ display: 'none' }}
                  disabled={Boolean(uploadingMedia) || !form.id}
                />
              </label>
              {!form.id && (
                <p className="admin-hint">Inserisci prima un ID per caricare immagini, audio e video</p>
              )}
              <input
                className={`admin-input${fieldErrors[`${code}.imageUrl`] ? ' admin-input--error' : ''}`}
                type="url"
                value={language.imageUrl}
                onChange={(e) => setLangField(code, 'imageUrl', e.target.value)}
                placeholder="URL immagine (oppure incolla link manuale)"
                aria-invalid={Boolean(fieldErrors[`${code}.imageUrl`])}
              />
              <FieldError fieldErrors={fieldErrors} path={`${code}.imageUrl`} />
                </>
              )}
            </section>
          );
        })}

        {/* Azioni */}
        <div className="admin-actions">
          <button
            className="admin-btn-draft"
            onClick={handleSaveDraft}
            disabled={saving || publishing || Boolean(uploadingMedia) || !form.id}
          >
            {saving ? 'Salvataggio…' : <><Save size={16} /> Salva bozza</>}
          </button>
          <button
            className="admin-btn-publish"
            onClick={handlePublish}
            disabled={publishing || saving || Boolean(uploadingMedia) || !form.id}
          >
            {publishing ? 'Pubblicazione…' : <><Send size={16} /> Pubblica</>}
          </button>
        </div>
      </div>
    </div>
  );
}
