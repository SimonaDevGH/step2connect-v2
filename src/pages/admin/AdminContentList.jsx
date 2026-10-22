import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Send, Trash2, Images } from 'lucide-react';
import ContentEditForm from './ContentEditForm';

const LANGS = ['it', 'en', 'bn'];
const VISIBILITY = [
  { value: 'internal', label: 'Interno' },
  { value: 'preview', label: 'Anteprima' },
  { value: 'published', label: 'Pubblicato' },
];

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function formatLastEdited(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function ContentVisibility({ item, disabled, onChange }) {
  const current = item.visibility || 'published';
  return (
    <div className="cms-row-visibility" role="group" aria-label={`Visibilità ${item.title || item.id}`}>
      {VISIBILITY.map(({ value, label }) => (
        <button
          type="button"
          key={value}
          className={`cms-row-visibility-btn cms-row-visibility-btn--${value}${current === value ? ' is-active' : ''}`}
          aria-pressed={current === value}
          disabled={disabled}
          onClick={() => onChange(item, value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AdminContentList({ types = ['guides', 'news', 'library', 'pages', 'site'], refreshKey = 0, adminToken, onUnauthorized }) {
  const [type, setType] = useState(types[0] || 'guides');
  const [lang, setLang] = useState('it');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [pendingVisibility, setPendingVisibility] = useState('');
  const [publishingId, setPublishingId] = useState('');

  useEffect(() => {
    if (!types.includes(type)) setType(types[0] || 'guides');
  }, [types, type]);

  const loadItems = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/admin/content?type=${encodeURIComponent(type)}&lang=${lang}`, adminToken);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
      else setError(err.message || 'Impossibile caricare i contenuti.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, lang, adminToken, onUnauthorized]);

  useEffect(() => { loadItems(); }, [loadItems, refreshKey]);

  const handleVisibility = async (item, visibility) => {
    if ((item.visibility || 'published') === visibility || pendingVisibility) return;
    if (visibility === 'published' && !window.confirm(`Pubblicare “${item.title || item.id}”? Sarà visibile a tutti gli utenti.`)) return;
    const itemKey = `${item.type}-${item.id}`;
    setPendingVisibility(itemKey);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/api/admin/content/${item.type}/${encodeURIComponent(item.id)}/visibility`, adminToken, {
        method: 'PUT',
        body: JSON.stringify({ visibility }),
      });
      setItems((previous) => previous.map((entry) => (
        `${entry.type}-${entry.id}` === itemKey ? { ...entry, visibility } : entry
      )));
      setNotice('Salvato');
      window.setTimeout(() => setNotice(''), 2400);
      await loadItems();
    } catch (err) {
      if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
      else setError(err.message || 'Impossibile aggiornare la visibilità.');
    } finally {
      setPendingVisibility('');
    }
  };

  const handlePublish = async (item) => {
    if (!window.confirm(`Pubblicare le modifiche a “${item.title || item.id}”?`)) return;
    setPublishingId(`${item.type}-${item.id}`);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/api/admin/content/${item.type}/${encodeURIComponent(item.id)}/publish`, adminToken, { method: 'POST' });
      setNotice('Modifiche pubblicate');
      await loadItems();
    } catch (err) {
      if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
      else setError(`Errore pubblicazione: ${err.message}`);
    } finally {
      setPublishingId('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/admin/content/${deleteTarget.type}/${encodeURIComponent(deleteTarget.id)}`, adminToken, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
      setDeleteError(err.message || 'Impossibile eliminare il contenuto.');
    } finally {
      setDeleting(false);
    }
  };

  if (editItem !== null) {
    return (
      <div className="cms-editor-wrap">
        <ContentEditForm
          contentType={editItem.type}
          contentId={editItem.id === 'new' ? null : editItem.id}
          onClose={() => { setEditItem(null); loadItems(); }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="cms-list-toolbar">
        {types.length > 1 && (
          <div className="admin-filter-group" aria-label="Tipo contenuto">
            {types.map((contentType) => (
              <button
                type="button"
                key={contentType}
                className={`admin-filter-btn ${type === contentType ? 'active' : ''}`}
                onClick={() => setType(contentType)}
              >
                {contentType === 'pages' ? 'Pagine' : contentType === 'site' ? 'Immagini app' : contentType}
              </button>
            ))}
          </div>
        )}
        <div className="admin-filter-group" aria-label="Lingua contenuti">
          {LANGS.map((language) => (
            <button
              type="button"
              key={language}
              className={`admin-filter-btn ${lang === language ? 'active' : ''}`}
              onClick={() => setLang(language)}
            >
              {language.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadItems} title="Ricarica" aria-label="Ricarica">
          <RefreshCw size={17} />
        </button>
        {(type !== 'site' || items.length === 0) && (
          <button type="button" className="admin-new-btn" onClick={() => setEditItem({ id: 'new', type })}>
            {type === 'site' ? <Images size={17} /> : <Plus size={17} />}
            {type === 'site' ? 'Configura immagini' : 'Nuovo'}
          </button>
        )}
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}
      {notice && <div className="admin-success cms-inline-notice" role="status">{notice}</div>}

      {loading ? (
        <div className="cms-list-skeleton" aria-label="Caricamento contenuti">
          <div /><div /><div />
        </div>
      ) : error && items.length === 0 ? (
        <div className="cms-list-error">
          <strong>Non è stato possibile caricare l’elenco.</strong>
          <button type="button" onClick={loadItems}>Riprova</button>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty cms-list-empty">
          <span className="cms-empty-mark">+</span>
          <strong>Nessun contenuto qui, per ora.</strong>
          <span>Crea una nuova pagina per iniziare.</span>
        </div>
      ) : (
        <div className="admin-list cms-admin-list" role="table" aria-label="Elenco contenuti">
          <div className="admin-list-header cms-list-header" role="row">
            <span aria-hidden="true" />
            <span>Contenuto</span>
            <span>Tipo</span>
            <span>Visibilità</span>
            <span>Stato</span>
            <span>Ultima modifica</span>
            <span>Percorso</span>
            <span>Azioni</span>
          </div>
          {items.map((item) => {
            const itemKey = `${item.type}-${item.id}`;
            const pending = pendingVisibility === itemKey;
            return (
              <div key={itemKey} className="admin-item cms-admin-item" role="row">
                <span className="admin-item-emoji">{item.emoji || '📄'}</span>
                <div className="admin-item-info">
                  <p className="admin-item-title">{item.title || item.id}</p>
                  <p className="admin-item-meta">{item.id}</p>
                </div>
                <span className="admin-item-cell admin-item-type" data-label="Tipo">{item.type}</span>
                {type !== 'site' ? (
                  <div className="admin-item-cell cms-visibility-cell" data-label="Visibilità">
                    <ContentVisibility
                      item={item}
                    disabled={Boolean(pendingVisibility)}
                      onChange={handleVisibility}
                    />
                    {pending && <span className="cms-row-saving">Salvataggio…</span>}
                  </div>
                ) : <span className="admin-item-cell cms-site-no-visibility" data-label="Visibilità">—</span>}
                <span className="admin-item-cell admin-item-status" data-label="Stato">
                  <span className={`admin-status admin-status--${item.status === 'published' ? 'published' : 'draft'}`}>
                    {item.status === 'published' ? 'Online' : 'Bozza'}
                  </span>
                </span>
                <span className="admin-item-cell admin-item-updated" data-label="Ultima modifica">{formatLastEdited(item.updatedAt)}</span>
                <span className="admin-item-cell admin-item-url" data-label="Percorso" title={item.url || ''}>{item.url || '—'}</span>
                <div className="admin-item-actions">
                  <button type="button" title="Modifica" aria-label={`Modifica ${item.title || item.id}`} onClick={() => setEditItem({ id: item.id, type: item.type })}><Pencil size={16} /></button>
                  {item.hasUnpublishedChanges && (
                    <button
                      type="button"
                      title="Pubblica modifiche"
                      aria-label={`Pubblica modifiche ${item.title || item.id}`}
                      disabled={publishingId === itemKey}
                      onClick={() => handlePublish(item)}
                    >
                      <Send size={16} />
                    </button>
                  )}
                  <button type="button" title="Elimina" aria-label={`Elimina ${item.title || item.id}`} className="admin-action-danger" onClick={() => { setDeleteTarget(item); setDeleteError(''); }}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-content-title">
            <h3 id="delete-content-title">Eliminare questa pagina?</h3>
            <p>Stai per eliminare <strong>{deleteTarget.title || deleteTarget.id}</strong>.</p>
            {deleteTarget.url && <p className="admin-modal-url">Anche l’URL <code>{deleteTarget.url}</code> non sarà più disponibile.</p>}
            <p className="admin-modal-hint">Bozza e contenuto pubblicato verranno rimossi in tutte le lingue.</p>
            {deleteError && <p className="admin-modal-error" role="alert">{deleteError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="admin-modal-cancel" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annulla</button>
              <button type="button" className="admin-modal-delete" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Eliminazione…' : 'OK, cancella'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
