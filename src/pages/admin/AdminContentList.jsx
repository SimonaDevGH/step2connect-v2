import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw, Send, Trash2, Images } from 'lucide-react';
import ContentEditForm from './ContentEditForm';
import { QuizEditForm, QuizImportToolbar } from './QuizTools';

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
  const [selectedQuizIds, setSelectedQuizIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });
  const selectAllRef = useRef(null);
  const bulkBusy = Boolean(bulkAction);
  const quizItems = type === 'quiz' ? items.filter((item) => item.type === 'quiz') : [];
  const selectedQuizCount = quizItems.filter((item) => selectedQuizIds.has(String(item.id))).length;
  const allQuizRowsSelected = quizItems.length > 0 && selectedQuizCount === quizItems.length;
  const someQuizRowsSelected = selectedQuizCount > 0 && !allQuizRowsSelected;
  const bulkActionsBlocked = bulkBusy || loading || Boolean(pendingVisibility || publishingId || deleting || deleteTarget);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someQuizRowsSelected;
  }, [someQuizRowsSelected]);

  useEffect(() => {
    if (!types.includes(type)) setType(types[0] || 'guides');
  }, [types, type]);

  const loadItems = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/admin/content?type=${encodeURIComponent(type)}&lang=${lang}`, adminToken);
      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      if (type === 'quiz') {
        const listedIds = new Set(nextItems.filter((item) => item.type === 'quiz').map((item) => String(item.id)));
        setSelectedQuizIds((previous) => new Set([...previous].filter((id) => listedIds.has(id))));
      } else {
        setSelectedQuizIds(new Set());
      }
    } catch (err) {
      if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
      else setError(err.message || 'Impossibile caricare i contenuti.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, lang, adminToken, onUnauthorized]);

  useEffect(() => { setSelectedQuizIds(new Set()); }, [type, lang]);
  useEffect(() => { if (!bulkBusy) loadItems(); }, [loadItems, refreshKey, bulkBusy]);

  const handleVisibility = async (item, visibility) => {
    if (bulkBusy || (item.visibility || 'published') === visibility || pendingVisibility) return;
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
    if (bulkBusy) return;
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

  const toggleQuizSelection = (id) => {
    if (bulkBusy) return;
    const key = String(id);
    setSelectedQuizIds((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllQuizSelection = () => {
    if (bulkBusy || loading || quizItems.length === 0) return;
    setSelectedQuizIds(allQuizRowsSelected
      ? new Set()
      : new Set(quizItems.map((item) => String(item.id))));
  };

  const handleBulkAction = async (action) => {
    if (bulkBusy || loading || pendingVisibility || publishingId || deleting || deleteTarget || selectedQuizCount === 0) return;
    const selectedItems = quizItems.filter((item) => selectedQuizIds.has(String(item.id)));
    const isPublish = action === 'publish';
    const confirmation = isPublish
      ? `Pubblicare ${selectedItems.length} quiz selezionati? Le modifiche saranno applicate in tutte e 3 le lingue (italiano, inglese e bengalese), mantenendo la visibilità attuale di ogni quiz.`
      : `Riportare in bozza ${selectedItems.length} quiz selezionati? La versione online sarà rimossa in tutte e 3 le lingue (italiano, inglese e bengalese); le bozze e la visibilità attuale saranno conservate.`;
    if (!window.confirm(confirmation)) return;

    setBulkAction(action);
    setBulkProgress({ completed: 0, total: selectedItems.length });
    setError('');
    setNotice('');
    const succeeded = [];
    const failed = [];
    for (const item of selectedItems) {
      try {
        const endpoint = `/api/admin/content/quiz/${encodeURIComponent(item.id)}/${isPublish ? 'publish' : 'unpublish'}`;
        await apiFetch(endpoint, adminToken, { method: 'POST' });
        succeeded.push(String(item.id));
      } catch (err) {
        if (err.status === 401 || err.message.toLowerCase().includes('token')) onUnauthorized?.();
        failed.push({ id: String(item.id), message: err.message || 'Errore sconosciuto' });
      }
      setBulkProgress((previous) => ({ ...previous, completed: previous.completed + 1 }));
    }
    setSelectedQuizIds(new Set(failed.map(({ id }) => id)));
    setBulkAction('');
    setNotice(
      `${isPublish ? 'Pubblicati' : 'Riportati in bozza'} ${succeeded.length} di ${selectedItems.length} quiz.` +
      (failed.length ? ` Non riusciti: ${failed.map(({ id, message }) => `${id} (${message})`).join('; ')}. I quiz non riusciti restano selezionati.` : ''),
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || bulkBusy) return;
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
        {editItem.type === 'quiz' ? (
          <QuizEditForm
            quizId={editItem.id === 'new' ? null : editItem.id}
            adminToken={adminToken}
            onUnauthorized={onUnauthorized}
            onClose={() => { setEditItem(null); loadItems(); }}
          />
        ) : (
          <ContentEditForm
            contentType={editItem.type}
            contentId={editItem.id === 'new' ? null : editItem.id}
            onClose={() => { setEditItem(null); loadItems(); }}
          />
        )}
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
                disabled={bulkBusy}
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
              disabled={bulkBusy}
              onClick={() => setLang(language)}
            >
              {language.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadItems} title="Ricarica" aria-label="Ricarica" disabled={bulkBusy}>
          <RefreshCw size={17} />
        </button>
        {(type !== 'site' || items.length === 0) && (
          <button type="button" className="admin-new-btn" onClick={() => setEditItem({ id: 'new', type })} disabled={bulkBusy}>
            {type === 'site' ? <Images size={17} /> : <Plus size={17} />}
            {type === 'site' ? 'Configura immagini' : 'Nuovo'}
          </button>
        )}
      </div>

      {type === 'quiz' && (
        <div className="cms-quiz-import-wrap" inert={bulkBusy ? '' : undefined} aria-disabled={bulkBusy || undefined}>
          <QuizImportToolbar adminToken={adminToken} onUnauthorized={onUnauthorized} onImported={loadItems} />
        </div>
      )}
      {type === 'quiz' && (
        <div className="cms-bulk-toolbar" aria-label="Azioni quiz selezionati">
          <label className="cms-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allQuizRowsSelected}
              disabled={loading || quizItems.length === 0 || bulkBusy}
              onChange={toggleAllQuizSelection}
            />
            <span>Seleziona tutti ({quizItems.length})</span>
          </label>
          <span className="cms-bulk-count" aria-live="polite">{selectedQuizCount} selezionati</span>
          <button type="button" className="cms-bulk-btn cms-bulk-btn--publish" disabled={!selectedQuizCount || bulkActionsBlocked} onClick={() => handleBulkAction('publish')}>
            {bulkAction === 'publish' ? 'Pubblicazione…' : 'Pubblica selezionati'}
          </button>
          <button type="button" className="cms-bulk-btn" disabled={!selectedQuizCount || bulkActionsBlocked} onClick={() => handleBulkAction('unpublish')}>
            {bulkAction === 'unpublish' ? 'Ripristino…' : 'Riporta in bozza'}
          </button>
          {bulkBusy && <span className="cms-bulk-progress" role="status">Operazione {Math.min(bulkProgress.completed + 1, bulkProgress.total)} di {bulkProgress.total}…</span>}
        </div>
      )}
      {error && <div className="admin-error" role="alert">{error}</div>}
      {notice && <div className={`${notice.includes('Non riusciti:') ? 'admin-error' : 'admin-success'} cms-inline-notice`} role={notice.includes('Non riusciti:') ? 'alert' : 'status'}>{notice}</div>}

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
            const isQuizRow = type === 'quiz' && item.type === 'quiz';
            return (
              <div key={itemKey} className="admin-item cms-admin-item" role="row">
                {isQuizRow ? (
                  <label className="cms-checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedQuizIds.has(String(item.id))}
                      disabled={bulkBusy}
                      onChange={() => toggleQuizSelection(item.id)}
                      aria-label={`Seleziona ${item.title || item.id}`}
                    />
                  </label>
                ) : <span className="admin-item-emoji">{item.emoji || '📄'}</span>}
                <div className="admin-item-info">
                  <p className="admin-item-title">{item.title || item.id}</p>
                  <p className="admin-item-meta">{item.id}</p>
                </div>
                <span className="admin-item-cell admin-item-type" data-label="Tipo">{item.type}</span>
                {type !== 'site' ? (
                  <div className="admin-item-cell cms-visibility-cell" data-label="Visibilità">
                    <ContentVisibility
                      item={item}
                      disabled={Boolean(pendingVisibility) || bulkBusy}
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
                  <button type="button" title="Modifica" aria-label={`Modifica ${item.title || item.id}`} disabled={bulkBusy} onClick={() => setEditItem({ id: item.id, type: item.type })}><Pencil size={16} /></button>
                  {item.hasUnpublishedChanges && (
                    <button
                      type="button"
                      title="Pubblica modifiche"
                      aria-label={`Pubblica modifiche ${item.title || item.id}`}
                      disabled={publishingId === itemKey || bulkBusy}
                      onClick={() => handlePublish(item)}
                    >
                      <Send size={16} />
                    </button>
                  )}
                  <button type="button" title="Elimina" aria-label={`Elimina ${item.title || item.id}`} className="admin-action-danger" disabled={bulkBusy} onClick={() => { setDeleteTarget(item); setDeleteError(''); }}><Trash2 size={16} /></button>
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
              <button type="button" className="admin-modal-cancel" onClick={() => setDeleteTarget(null)} disabled={deleting || bulkBusy}>Annulla</button>
              <button type="button" className="admin-modal-delete" onClick={handleConfirmDelete} disabled={deleting || bulkBusy}>{deleting ? 'Eliminazione…' : 'OK, cancella'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
