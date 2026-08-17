import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Trash2, Send, RefreshCw, LogOut, UserCircle } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import ContentEditForm from './ContentEditForm';

const TYPES = ['guides', 'news', 'library', 'pages'];
const LANGS = ['it', 'en', 'bn'];

// Route admin: URL sempre relativi (proxy Vite in dev, Express stesso origin in prod).
const API = '';

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
  const { adminToken, adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [type,    setType]    = useState('guides');
  const [lang,    setLang]    = useState('it');
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [editId,  setEditId]  = useState(null);

  const loadItems = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/admin/content?type=${type}&lang=${lang}`, adminToken);
      setItems(data);
    } catch (err) {
      if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
        logout();
        navigate('/admin/login', { replace: true });
      } else {
        setError(err.message);
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, lang, adminToken, logout, navigate]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDelete = async (id) => {
    if (!confirm(`Archiviare il contenuto "${id}"?`)) return;
    try {
      await apiFetch(`/api/admin/content/${type}/${id}`, adminToken, { method: 'DELETE' });
      loadItems();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const handlePublish = async (id) => {
    if (!confirm(`Pubblicare "${id}"? Sarà visibile a tutti gli utenti.`)) return;
    try {
      await apiFetch(`/api/admin/content/${type}/${id}/publish`, adminToken, { method: 'POST' });
      alert('Pubblicato!');
    } catch (err) {
      alert('Errore pubblicazione: ' + err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
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
        <button className="back-btn" onClick={() => navigate('/')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">⚙️</div>
        <h2 className="page-hero-title">Gestione contenuti</h2>
        <p className="page-hero-sub">{adminUser?.name || adminUser?.email || 'Admin'}</p>
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
        <button
          className="admin-refresh-btn"
          onClick={() => navigate('/admin/account')}
          title="Il mio account"
          style={{ marginLeft: 'auto' }}
        >
          <UserCircle size={18} />
        </button>
        <button
          className="admin-refresh-btn"
          onClick={handleLogout}
          title="Esci"
          style={{ color: '#c0392b' }}
        >
          <LogOut size={18} />
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
                <p className="admin-item-meta">
                  {item.id}
                  {item.url ? ` · ${item.url}` : ''}
                  {' · '}
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('it') : '—'}
                </p>
              </div>
              <div className="admin-item-actions">
                <button title="Modifica"  onClick={() => setEditId(item.id)}><Pencil size={16} /></button>
                <button title="Pubblica"  onClick={() => handlePublish(item.id)}><Send size={16} /></button>
                <button title="Archivia"  className="admin-action-danger" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
