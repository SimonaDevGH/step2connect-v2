import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Send, Upload, Music, Video } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

// Route admin: URL sempre relativi (proxy Vite in dev, Express stesso origin in prod).
const API = '';
const LANGS = [
  { code: 'it', label: 'Italiano 🇮🇹' },
  { code: 'en', label: 'English 🇬🇧' },
  { code: 'bn', label: 'বাংলা 🇧🇩' },
];
const TYPES = ['guides', 'news', 'library', 'pages'];

const GUIDE_CATEGORIES = [
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
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const emptyLang = () => ({
  title: '', body: '', audioUrl: '', videoUrl: '', metaDesc: '', emoji: '📄', imageUrl: '',
});
const defaultForm = () => ({
  id: '', type: 'guides', category: '', url: '',
  it: emptyLang(), en: emptyLang(), bn: emptyLang(),
});

export default function ContentEditForm({ contentType, contentId, onClose }) {
  const isNew = !contentId;
  const { adminToken, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [form,         setForm]         = useState(() => ({ ...defaultForm(), type: contentType || 'guides' }));
  // Mantiene l'ID dell'ultimo draft salvato: dopo una rinomina il successivo
  // "Pubblica" deve puntare alla nuova chiave S3, non a quella precedente.
  const [savedId,      setSavedId]      = useState(contentId || '');
  const [loading,      setLoading]      = useState(!isNew);
  const [saving,       setSaving]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [uploadingImg, setUploadingImg] = useState('');

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

  const setLangField = (lang, field, value) => {
    setForm((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
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
      handleAuthError(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Pubblicare? Il contenuto sarà visibile a tutti gli utenti.')) return;
    setPublishing(true);
    setError('');
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
      handleAuthError(err);
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleImageUpload = async (lang, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(lang);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiFetch(
        `/api/admin/content/${form.type}/${form.id || 'new'}/media`,
        adminToken,
        { method: 'POST', body: fd }
      );
      setLangField(lang, 'imageUrl', data.url);
      setSuccess('Immagine caricata ✓');
    } catch (err) {
      handleAuthError(err);
      setError('Upload fallito: ' + err.message);
    } finally {
      setUploadingImg('');
    }
  };

  if (loading) return <div className="admin-loading">Caricamento…</div>;

  const isPages    = form.type === 'pages';
  const isGuides   = form.type === 'guides';
  const guidePath  = isGuides && form.category && form.id
    ? `/guides/${form.category}/${form.id}`
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
        {error   && <div className="admin-error">⚠️ {error}</div>}
        {success && <div className="admin-success">✓ {success}</div>}

        {/* Metadati base */}
        <div className="admin-section">
          <label className="admin-label">{isGuides ? 'Nome pagina / ID *' : 'ID univoco *'}</label>
          <input
            className="admin-input"
            value={form.id}
            onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
            placeholder={isGuides ? 'es. permesso-di-soggiorno' : 'es. news-001'}
          />
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
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
          >
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>

          {/* Categoria: dropdown per guides, testo libero per gli altri */}
          <label className="admin-label">Categoria</label>
          {isGuides ? (
            <select
              className="admin-input"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="">— seleziona categoria —</option>
              {GUIDE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="admin-input"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="es. documents"
            />
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
                className="admin-input"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="/percorso/pubblico/della-pagina"
              />
            </>
          )}
        </div>

        <p className="admin-language-intro">
          Compila ogni lingua separatamente. Titolo, testo, media, immagine e icona
          vengono salvati solo nella rispettiva versione.
        </p>

        {LANGS.map(({ code, label }) => {
          const language = form[code];
          return (
            <section className="admin-language-section" key={code}>
              <h3 className="admin-language-heading">{label}</h3>

              <label className="admin-label">Titolo ({code.toUpperCase()}) *</label>
              <input
                className="admin-input"
                value={language.title}
                onChange={(e) => setLangField(code, 'title', e.target.value)}
                placeholder="Titolo"
              />

              {isPages ? (
                <>
                  <label className="admin-label" style={{ color: '#c0392b' }}>
                    Meta description ({code.toUpperCase()}) — SEO
                    <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                      max 300 caratteri
                    </span>
                  </label>
                  <textarea
                    className="admin-textarea admin-meta-textarea"
                    value={language.metaDesc}
                    onChange={(e) => setLangField(code, 'metaDesc', e.target.value)}
                    placeholder="Breve descrizione per i motori di ricerca e le anteprime social"
                    rows={2}
                    maxLength={300}
                  />
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
                    className="admin-input"
                    value={language.metaDesc}
                    onChange={(e) => setLangField(code, 'metaDesc', e.target.value)}
                    placeholder="Descrizione breve (opzionale)"
                    maxLength={300}
                  />
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
                className="admin-textarea"
                value={language.body}
                onChange={(e) => setLangField(code, 'body', e.target.value)}
                placeholder={
                  isPages
                    ? 'Corpo della pagina — HTML consentito incluso <img src="..." alt="...">'
                    : 'Testo del contenuto (HTML: b, i, ul, ol, li, p, br, a, h2, h3)'
                }
                rows={10}
              />

              <label className="admin-label">
                <Music size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Audio MP3 ({code.toUpperCase()}) — opzionale
              </label>
              <input
                className="admin-input"
                type="url"
                value={language.audioUrl}
                onChange={(e) => setLangField(code, 'audioUrl', e.target.value)}
                placeholder="https://…/audio.mp3"
              />

              <label className="admin-label">
                <Video size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                URL video ({code.toUpperCase()}) — opzionale
              </label>
              <input
                className="admin-input"
                type="url"
                value={language.videoUrl}
                onChange={(e) => setLangField(code, 'videoUrl', e.target.value)}
                placeholder="https://…/video.mp4"
              />

              <label className="admin-label">Icona ({code.toUpperCase()})</label>
              <input
                className="admin-input admin-emoji-input"
                value={language.emoji}
                onChange={(e) => setLangField(code, 'emoji', e.target.value)}
                placeholder="📄"
                maxLength={10}
              />

              <label className="admin-label">Immagine copertina ({code.toUpperCase()})</label>
              {language.imageUrl && (
                <img src={language.imageUrl} alt={`Anteprima ${label}`} className="admin-img-preview" />
              )}
              <label className="admin-upload-btn">
                {uploadingImg === code ? 'Caricamento…' : <><Upload size={16} /> Carica immagine {code.toUpperCase()}</>}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(code, e)}
                  style={{ display: 'none' }}
                  disabled={Boolean(uploadingImg) || !form.id}
                />
              </label>
              {!form.id && (
                <p className="admin-hint">Inserisci prima un ID per caricare l'immagine</p>
              )}
              <input
                className="admin-input"
                type="url"
                value={language.imageUrl}
                onChange={(e) => setLangField(code, 'imageUrl', e.target.value)}
                placeholder="URL immagine (oppure incolla link manuale)"
              />
            </section>
          );
        })}

        {/* Azioni */}
        <div className="admin-actions">
          <button
            className="admin-btn-draft"
            onClick={handleSaveDraft}
            disabled={saving || !form.id}
          >
            {saving ? 'Salvataggio…' : <><Save size={16} /> Salva bozza</>}
          </button>
          <button
            className="admin-btn-publish"
            onClick={handlePublish}
            disabled={publishing || !form.id}
          >
            {publishing ? 'Pubblicazione…' : <><Send size={16} /> Pubblica</>}
          </button>
        </div>
      </div>
    </div>
  );
}
