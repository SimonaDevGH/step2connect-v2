import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Trash2, Send, RefreshCw, LogOut, UserCircle } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import ContentEditForm from './ContentEditForm';

const TYPES = [
  { value: 'guides', label: 'guides' },
  { value: 'news', label: 'news' },
  { value: 'library', label: 'library' },
  { value: 'all', label: 'pages' },
];
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

function formatLastEdited(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function AdminContentPage() {
  const { adminToken, adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [type,     setType]     = useState('guides');
  const [lang,     setLang]     = useState('it');
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const handleDelete = (item) => {
    setDeleteTarget(item);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(
        `/api/admin/content/${deleteTarget.type}/${deleteTarget.id}`,
        adminToken,
        { method: 'DELETE' }
      );
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async (item) => {
    if (!confirm(`Pubblicare "${item.id}"? Sarà visibile a tutti gli utenti.`)) return;
    try {
      await apiFetch(`/api/admin/content/${item.type}/${item.id}/publish`, adminToken, { method: 'POST' });
      alert('Pubblicato!');
      loadItems();
    } catch (err) {
      alert('Errore pubblicazione: ' + err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  if (editItem !== null) {
    return (
      <ContentEditForm
        contentType={editItem.type}
        contentId={editItem.id === 'new' ? null : editItem.id}
        onClose={() => { setEditItem(null); loadItems(); }}
      />
    );
  }

  return (
    <>
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
              key={tp.value}
              className={`admin-filter-btn ${type === tp.value ? 'active' : ''}`}
              onClick={() => setType(tp.value)}
            >
              {tp.label}
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
        {type !== 'all' && (
          <button className="admin-new-btn" onClick={() => setEditItem({ id: 'new', type })}>
            <Plus size={18} /> Nuovo
          </button>
        )}
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
          Nessun contenuto trovato per <strong>{type === 'all' ? 'pages' : type}</strong> / <strong>{lang.toUpperCase()}</strong>
        </div>
      ) : (
        <div className="admin-list" role="table" aria-label="Elenco contenuti">
          <div className="admin-list-header" role="row">
            <span aria-hidden="true" />
            <span>Contenuto</span>
            <span>Tipo</span>
            <span>Stato</span>
            <span>Ultima modifica</span>
            <span>Percorso</span>
            <span>Azioni</span>
          </div>
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="admin-item" role="row">
              <span className="admin-item-emoji">{item.emoji || '📄'}</span>
              <div className="admin-item-info">
                <p className="admin-item-title">{item.title || item.id}</p>
                <p className="admin-item-meta">{item.id}</p>
              </div>
              <span className="admin-item-cell admin-item-type" data-label="Tipo">{item.type}</span>
              <span className="admin-item-cell admin-item-status" data-label="Stato">
                <span className={`admin-status admin-status--${item.status}`}>
                  {item.status === 'published' ? 'Pubblicato' : 'Bozza'}
                </span>
              </span>
              <span className="admin-item-cell admin-item-updated" data-label="Ultima modifica">
                {formatLastEdited(item.updatedAt)}
              </span>
              <span className="admin-item-cell admin-item-url" data-label="Percorso" title={item.url || ''}>
                {item.url || '—'}
              </span>
              <div className="admin-item-actions">
                <button title="Modifica"  onClick={() => setEditItem({ id: item.id, type: item.type })}><Pencil size={16} /></button>
                <button title="Pubblica"  onClick={() => handlePublish(item)}><Send size={16} /></button>
                <button title="Elimina" className="admin-action-danger" onClick={() => handleDelete(item)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {deleteTarget && (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-content-title"
          >
            <h3 id="delete-content-title">Eliminare questa pagina?</h3>
            <p>
              Stai per eliminare <strong>{deleteTarget.title || deleteTarget.id}</strong>.
            </p>
            {deleteTarget.url && (
              <p className="admin-modal-url">
                Anche l’URL <code>{deleteTarget.url}</code> non sarà più disponibile.
              </p>
            )}
            <p className="admin-modal-hint">
              Bozza e contenuto pubblicato verranno rimossi in tutte le lingue.
            </p>
            {deleteError && <p className="admin-modal-error">⚠️ {deleteError}</p>}
            <div className="admin-modal-actions">
              <button
                className="admin-modal-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Annulla
              </button>
              <button
                className="admin-modal-delete"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminazione…' : 'OK, cancella'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
