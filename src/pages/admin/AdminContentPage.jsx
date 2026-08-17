import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Eye, Pencil, Trash2, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import ContentEditForm from './ContentEditForm';

const TYPES = ['guides', 'news', 'library'];
const LANGS = ['it', 'en', 'bn'];

const API = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function AdminContentPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [type, setType] = useState('guides');
  const [lang, setLang] = useState('it');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null); // null = list, 'new' = create, 'xxx' = edit

  // Controlla gruppo content-admin (lato client, solo UX)
  const isAdmin = user?.groups?.includes('content-admin') || user?.['cognito:groups']?.includes('content-admin') || true; // lascia passare — la vera protezione è server-side
  useEffect(() => {
    if (!user) navigate('/home');
  }, [user, navigate]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Usiamo l'idToken dalla sessione Amplify
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session?.tokens?.idToken?.toString();
      const data = await apiFetch(`/api/admin/content?type=${type}&lang=${lang}`, token);
      setItems(data);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, lang]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDelete = async (id) => {
    if (!confirm(`Archiviare il contenuto "${id}"?`)) return;
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session?.tokens?.idToken?.toString();
      await apiFetch(`/api/admin/content/${type}/${id}`, token, { method: 'DELETE' });
      loadItems();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const handlePublish = async (id) => {
    if (!confirm(`Pubblicare "${id}"? Sarà visibile a tutti gli utenti.`)) return;
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session?.tokens?.idToken?.toString();
      await apiFetch(`/api/admin/content/${type}/${id}/publish`, token, { method: 'POST' });
      alert('Pubblicato!');
    } catch (err) {
      alert('Errore pubblicazione: ' + err.message);
    }
  };

  if (editId !== null) {
    return (
      <ContentEditForm
        contentType={type}
        contentId={editId === 'new' ? null : editId}
        onClose={() => { setEditId(null); loadItems(); }}
      />
    );
  }

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#1D3557' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">⚙️</div>
        <h2 className="page-hero-title">Gestione contenuti</h2>
        <p className="page-hero-sub">Area admin — solo content-admin</p>
      </div>

      <div className="admin-toolbar">
        {/* Tipo */}
        <div className="admin-filter-group">
          {TYPES.map((tp) => (
            <button
              key={tp}
              className={`admin-filter-btn ${type === tp ? 'active' : ''}`}
              onClick={() => setType(tp)}
            >
              {tp}
            </button>
          ))}
        </div>
        {/* Lingua */}
        <div className="admin-filter-group">
          {LANGS.map((l) => (
            <button
              key={l}
              className={`admin-filter-btn ${lang === l ? 'active' : ''}`}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="admin-refresh-btn" onClick={loadItems} title="Ricarica">
          <RefreshCw size={18} />
        </button>
        <button className="admin-new-btn" onClick={() => setEditId('new')}>
          <Plus size={18} /> Nuovo
        </button>
      </div>

      {error && <div className="admin-error">⚠️ {error}</div>}

      {loading ? (
        <div className="admin-loading">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="admin-empty">
          Nessun contenuto trovato per <strong>{type}</strong> / <strong>{lang.toUpperCase()}</strong>
        </div>
      ) : (
        <div className="admin-list">
          {items.map((item) => (
            <div key={item.id} className="admin-item">
              <span className="admin-item-emoji">{item.emoji || '📄'}</span>
              <div className="admin-item-info">
                <p className="admin-item-title">{item.title || item.id}</p>
                <p className="admin-item-meta">{item.id} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('it') : '—'}</p>
              </div>
              <div className="admin-item-actions">
                <button title="Modifica" onClick={() => setEditId(item.id)}><Pencil size={16} /></button>
                <button title="Pubblica" onClick={() => handlePublish(item.id)}><Send size={16} /></button>
                <button title="Archivia" className="admin-action-danger" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
