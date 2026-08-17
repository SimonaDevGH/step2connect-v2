import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Send, Upload, Music } from 'lucide-react';
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

const emptyLang = () => ({ title: '', body: '', audioUrl: '', metaDesc: '' });
const defaultForm = () => ({
  id: '', type: 'guides', category: '', emoji: '📄', imageUrl: '', url: '',
  it: emptyLang(), en: emptyLang(), bn: emptyLang(),
});

export default function ContentEditForm({ contentType, contentId, onClose }) {
  const isNew = !contentId;
  const { adminToken, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [form,         setForm]         = useState(() => ({ ...defaultForm(), type: contentType || 'guides' }));
  const [activeLang,   setActiveLang]   = useState('it');
  const [loading,      setLoading]      = useState(!isNew);
  const [saving,       setSaving]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

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
      await apiFetch(`/api/admin/content/${form.type}/${form.id}`, adminToken, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
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
      await apiFetch(`/api/admin/content/${form.type}/${form.id}`, adminToken, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await apiFetch(`/api/admin/content/${form.type}/${form.id}/publish`, adminToken, { method: 'POST' });
      setSuccess('Pubblicato! ✓');
    } catch (err) {
      handleAuthError(err);
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiFetch(
        `/api/admin/content/${form.type}/${form.id || 'new'}/media`,
        adminToken,
        { method: 'POST', body: fd }
      );
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
      setSuccess('Immagine caricata ✓');
    } catch (err) {
      handleAuthError(err);
      setError('Upload fallito: ' + err.message);
    } finally {
      setUploadingImg(false);
    }
  };

  if (loading) return <div className="admin-loading">Caricamento…</div>;

  const curLang    = form[activeLang];
  const isPages    = form.type === 'pages';
  const isGuides   = form.type === 'guides';

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
          <label className="admin-label">ID univoco *</label>
          <input
            className="admin-input"
            value={form.id}
            onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
            placeholder="es. permitRequest"
            disabled={!isNew}
          />

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

          <label className="admin-label">Emoji</label>
          <input
            className="admin-input"
            value={form.emoji}
            onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))}
            placeholder="📄"
            maxLength={4}
            style={{ width: 80 }}
          />

          {/* URL pagina — visibile e obbligatorio solo per pages */}
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

        {/* Immagine */}
        <div className="admin-section">
          <label className="admin-label">Immagine copertina</label>
          {form.imageUrl && (
            <img src={form.imageUrl} alt="" className="admin-img-preview" />
          )}
          <label className="admin-upload-btn">
            {uploadingImg ? 'Caricamento…' : <><Upload size={16} /> Carica immagine</>}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              disabled={uploadingImg || !form.id}
            />
          </label>
          {!form.id && (
            <p className="admin-hint">Inserisci prima un ID per caricare l'immagine</p>
          )}
          <input
            className="admin-input"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
            placeholder="URL immagine (oppure incolla link manuale)"
          />
        </div>

        {/* Tab lingua */}
        <div className="admin-lang-tabs">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`admin-lang-tab ${activeLang === l.code ? 'active' : ''}`}
              onClick={() => setActiveLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Campi lingua attiva */}
        <div className="admin-section">
          <label className="admin-label">Titolo ({activeLang.toUpperCase()}) *</label>
          <input
            className="admin-input"
            value={curLang.title}
            onChange={(e) => setLangField(activeLang, 'title', e.target.value)}
            placeholder="Titolo"
          />

          {/* Meta description — prominente per pages, disponibile anche per altri */}
          {isPages ? (
            <>
              <label className="admin-label" style={{ color: '#c0392b' }}>
                Meta description ({activeLang.toUpperCase()}) — SEO
                <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                  max 300 caratteri
                </span>
              </label>
              <textarea
                className="admin-textarea"
                value={curLang.metaDesc}
                onChange={(e) => setLangField(activeLang, 'metaDesc', e.target.value)}
                placeholder="Breve descrizione per i motori di ricerca e le anteprime social"
                rows={2}
                maxLength={300}
              />
            </>
          ) : (
            <>
              <label className="admin-label">
                Meta description ({activeLang.toUpperCase()})
                <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                  opzionale, max 300 car.
                </span>
              </label>
              <input
                className="admin-input"
                value={curLang.metaDesc}
                onChange={(e) => setLangField(activeLang, 'metaDesc', e.target.value)}
                placeholder="Descrizione breve (opzionale)"
                maxLength={300}
              />
            </>
          )}

          <label className="admin-label">
            Testo / Corpo ({activeLang.toUpperCase()})
            {isPages && (
              <span style={{ fontWeight: 400, color: '#666', fontSize: 12, marginLeft: 6 }}>
                HTML: b, i, ul, ol, li, p, br, a, h2, h3, img
              </span>
            )}
          </label>
          <textarea
            className="admin-textarea"
            value={curLang.body}
            onChange={(e) => setLangField(activeLang, 'body', e.target.value)}
            placeholder={
              isPages
                ? 'Corpo della pagina — HTML consentito incluso <img src="..." alt="...">'
                : 'Testo del contenuto (HTML: b, i, ul, ol, li, p, br, a, h2, h3)'
            }
            rows={12}
          />

          <label className="admin-label">
            <Music size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Audio MP3 ({activeLang.toUpperCase()}) — opzionale
          </label>
          <input
            className="admin-input"
            value={curLang.audioUrl}
            onChange={(e) => setLangField(activeLang, 'audioUrl', e.target.value)}
            placeholder="URL audio MP3"
          />
          <p className="admin-hint">In futuro questo campo sarà popolato automaticamente da text-to-speech.</p>
        </div>

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
