import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Download, FileUp, Plus, Save, Trash2, X } from 'lucide-react';
import './admin-notifications.css';

const LANGS = ['it', 'en', 'bn'];
const LANG_LABELS = { it: 'Italiano', en: 'English', bn: 'বাংলা' };
const EMPTY = {
  id: '', obiettivo: 'leggere_contenuti', tipo: 'content_engagement', contentId: '', guideId: '', link: '',
  message: { it: '', en: '', bn: '' }, startDate: '', endDate: '', frequency: 'una_volta', active: true,
  territory: 'Tutti', dateStatus: 'Confermata', hook: '',
};

async function request(path, token, options = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  if (options.raw) {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const blankRecord = () => ({ ...EMPTY, id: `N-${Date.now().toString().slice(-6)}`, message: { ...EMPTY.message } });

export default function AdminNotifications({ adminToken, onUnauthorized, refreshKey }) {
  const [notifications, setNotifications] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankRecord);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [month, setMonth] = useState(() => new Date());
  const [filterMonth, setFilterMonth] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [filterMissing, setFilterMissing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  const handleError = (error) => {
    if (error?.status === 401 || String(error?.message).includes('401')) onUnauthorized?.();
    setFeedback({ type: 'error', text: error?.message || 'Si è verificato un errore.' });
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [result, guideResult] = await Promise.all([
        request('/api/admin/notifications', adminToken),
        request('/api/admin/content?type=guides&lang=it', adminToken),
      ]);
      setNotifications(result.notifications || []);
      setGuides(Array.isArray(guideResult) ? guideResult : guideResult.guides || []);
    } catch (error) {
      if (error.status === 401 || String(error.message).includes('401')) onUnauthorized?.();
      setLoadError(error.message || 'Impossibile caricare le notifiche.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [adminToken, refreshKey]);

  const filtered = useMemo(() => notifications.filter((item) => {
    if (filterMonth && !String(item.startDate || '').startsWith(filterMonth)) return false;
    if (filterActive === 'active' && !item.active) return false;
    if (filterActive === 'inactive' && item.active) return false;
    if (filterMissing && LANGS.every((lang) => item.message?.[lang]?.trim())) return false;
    return true;
  }), [notifications, filterMonth, filterActive, filterMissing]);

  const startNew = () => {
    setEditing('new');
    setForm(blankRecord());
    setFeedback({ type: '', text: '' });
  };
  const startEdit = (item) => {
    setEditing(item.id);
    setForm({ ...EMPTY, ...item, message: { ...EMPTY.message, ...(item.message || {}) } });
    setFeedback({ type: '', text: '' });
  };
  const closeEditor = () => { if (!busy) setEditing(null); };
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setMessage = (lang, value) => setForm((current) => ({ ...current, message: { ...current.message, [lang]: value } }));

  const selectGuide = (id) => {
    const guide = guides.find((entry) => String(entry.id) === id);
    if (!guide) {
      setForm((current) => ({ ...current, guideId: '', contentId: '', link: '' }));
      return;
    }
    const contentId = guide.contentId || guide.id;
    const link = guide.url?.startsWith('/')
      ? guide.url
      : `/guides/${guide.category || 'documents'}/${guide.id}`;
    setForm((current) => ({ ...current, guideId: String(guide.id), contentId: String(contentId), link }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.id.trim() || !form.message.it.trim() || !form.startDate || !form.endDate) {
      setFeedback({ type: 'error', text: 'ID, messaggio italiano e date di inizio e fine sono obbligatori.' });
      return;
    }
    if (form.startDate > form.endDate) {
      setFeedback({ type: 'error', text: 'La data di inizio deve precedere la data di fine.' });
      return;
    }
    if (form.tipo === 'content_engagement' && !form.guideId) {
      setFeedback({ type: 'error', text: 'Scegli una guida per le notifiche sui contenuti.' });
      return;
    }
    if (form.link && !form.link.startsWith('/') && !form.link.startsWith('https://')) {
      setFeedback({ type: 'error', text: 'Il link deve iniziare con / oppure https://.' });
      return;
    }
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const saved = await request(`/api/admin/notifications/${encodeURIComponent(form.id)}`, adminToken, {
        method: 'PUT', body: JSON.stringify(form),
      });
      setNotifications(saved.notifications || []);
      setEditing(null);
      setFeedback({ type: 'success', text: 'Notifica salvata.' });
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };

  const toggleActive = async (item) => {
    if (busy) return;
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const result = await request(`/api/admin/notifications/${encodeURIComponent(item.id)}`, adminToken, {
        method: 'PUT', body: JSON.stringify({ ...item, active: !item.active }),
      });
      setNotifications(result.notifications || []);
      setFeedback({ type: 'success', text: 'Stato aggiornato.' });
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Eliminare la notifica ${item.id}? Questa azione non può essere annullata.`)) return;
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const result = await request(`/api/admin/notifications/${encodeURIComponent(item.id)}`, adminToken, { method: 'DELETE' });
      setNotifications(result.notifications || []);
      setEditing(null);
      setFeedback({ type: 'success', text: 'Notifica eliminata.' });
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };

  const exportFile = async () => {
    setBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await request('/api/admin/notifications/export', adminToken, { raw: true });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'calendario-notifiche.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setFeedback({ type: 'success', text: 'Esportazione avviata.' });
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  };

  const previewFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    setImportBusy(true);
    setPreview(null);
    setFeedback({ type: '', text: '' });
    try {
      setPreview(await request('/api/admin/notifications/import/preview', adminToken, { method: 'POST', body: data }));
    } catch (error) { handleError(error); }
    finally { setImportBusy(false); }
  };

  const confirmImport = async () => {
    if (!preview || preview.rows?.some((row) => row.errors?.length)) return;
    const eligible = (preview.rows || []).filter((row) => !row.skipped && row.action !== 'skip').map((row) => row.notification);
    if (!eligible.length) return;
    setImportBusy(true);
    try {
      const result = await request('/api/admin/notifications/import/confirm', adminToken, {
        method: 'POST', body: JSON.stringify({ notifications: eligible }),
      });
      setNotifications(result.notifications || []);
      setPreview(null);
      setFeedback({ type: 'success', text: `Import completato: ${result.imported ?? eligible.length} notifiche.` });
    } catch (error) { handleError(error); }
    finally { setImportBusy(false); }
  };

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null;
    });
  }, [month]);

  const calendarItems = (day) => notifications.filter((item) => item.startDate ===
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

  return (
    <section className="cms-notifications">
      <div className="cms-notif-toolbar">
        <div className="cms-notif-toolbar-copy">
          <p className="cms-eyebrow">Calendario editoriale</p>
          <h2>Notifiche in app <span>{notifications.length}</span></h2>
        </div>
        <div className="cms-notif-actions">
          <label className="cms-notif-button cms-notif-button--quiet">
            <FileUp size={16} /> Importa da Excel
            <input type="file" accept=".xlsx" onChange={previewFile} disabled={busy || importBusy} />
          </label>
          <button type="button" className="cms-notif-button cms-notif-button--quiet" onClick={exportFile} disabled={busy}>
            <Download size={16} /> Esporta Excel
          </button>
          <button type="button" className="cms-notif-button cms-notif-button--primary" onClick={startNew}>
            <Plus size={17} /> Nuova notifica
          </button>
        </div>
      </div>

      {feedback.text && <div className={`cms-notif-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
      {importBusy && !preview && <div className="cms-notif-loading"><i /><i /><i /></div>}
      {preview && <ImportPreview preview={preview} busy={importBusy} onCancel={() => setPreview(null)} onConfirm={confirmImport} />}

      <div className="cms-notif-viewbar">
        <div className="cms-notif-tabs" role="tablist" aria-label="Vista notifiche">
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>Elenco</button>
          <button type="button" role="tab" aria-selected={view === 'calendar'} className={view === 'calendar' ? 'is-active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15} /> Calendario</button>
        </div>
        {view === 'list' && <div className="cms-notif-filters">
          <label>Mese <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} /></label>
          <label>Stato <select value={filterActive} onChange={(event) => setFilterActive(event.target.value)}><option value="all">Tutte</option><option value="active">Attive</option><option value="inactive">Non attive</option></select></label>
          <label className="cms-notif-check"><input type="checkbox" checked={filterMissing} onChange={(event) => setFilterMissing(event.target.checked)} /> Traduzioni mancanti</label>
        </div>}
      </div>

      {loading ? <div className="cms-notif-loading" aria-label="Caricamento notifiche"><i /><i /><i /></div> : loadError ? (
        <div className="cms-notif-state is-error"><Bell size={22} /><strong>Non è stato possibile caricare il calendario</strong><span>{loadError}</span><button type="button" onClick={load}>Riprova</button></div>
      ) : view === 'list' ? (
        <NotificationList items={filtered} busy={busy} onEdit={startEdit} onToggle={toggleActive} />
      ) : (
        <div className="cms-notif-calendar">
          <div className="cms-notif-calendar-head">
            <button type="button" aria-label="Mese precedente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <h3>{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3>
            <button type="button" aria-label="Mese successivo" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
            <button type="button" className="cms-notif-today" onClick={() => setMonth(new Date())}>Oggi</button>
          </div>
          <div className="cms-notif-calendar-grid">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <b key={day}>{day}</b>)}
            {calendarDays.map((day, index) => <div className={`cms-notif-day${day ? '' : ' is-outside'}`} key={`${monthKey(month)}-${index}`}>
              {day && <><span className="cms-notif-day-number">{day.getDate()}</span>{calendarItems(day.getDate()).map((item) =>
                <button type="button" key={item.id} className={`cms-notif-event${item.active ? '' : ' is-inactive'}`} onClick={() => startEdit(item)} title={`${item.id} · ${item.message?.it || ''}`}>{item.id}<small>{item.message?.it || 'Senza messaggio'}</small></button>
              )}</>}
            </div>)}
          </div>
        </div>
      )}

      {editing && <div className="cms-notif-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
        <form className="cms-notif-editor" onSubmit={save} aria-label={editing === 'new' ? 'Nuova notifica' : 'Modifica notifica'}>
          <header><div><p className="cms-eyebrow">{editing === 'new' ? 'Nuovo elemento' : 'Modifica elemento'}</p><h2>{editing === 'new' ? 'Nuova notifica' : form.id}</h2></div><button type="button" aria-label="Chiudi" onClick={closeEditor}><X size={19} /></button></header>
          {feedback.text && <div className={`cms-notif-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
          <div className="cms-notif-form-grid">
            <Field label="ID notifica *"><input value={form.id} readOnly={editing !== 'new'} onChange={(event) => setField('id', event.target.value)} required /></Field>
            <Field label="Obiettivo"><select value={form.obiettivo} onChange={(event) => { const value = event.target.value; setField('obiettivo', value); setField('tipo', value === 'leggere_contenuti' ? 'content_engagement' : 'function_engagement'); }}>
              <option value="leggere_contenuti">Leggere contenuti</option><option value="usare_funzioni">Usare funzioni</option>
            </select></Field>
            <Field label="Tipo"><select value={form.tipo} onChange={(event) => setField('tipo', event.target.value)}><option value="content_engagement">Content engagement</option><option value="function_engagement">Function engagement</option><option value="welcome">Benvenuto</option></select></Field>
            <Field label={`Guida CMS ${form.tipo === 'content_engagement' ? '*' : '(opzionale)'}`} wide>
              <select value={form.guideId} onChange={(event) => selectGuide(event.target.value)}><option value="">Seleziona una guida</option>{guides.map((guide) => <option key={guide.id} value={guide.id}>{guide.title || guide.id} · {guide.id}</option>)}</select>
            </Field>
            <Field label="ID contenuto"><input value={form.contentId} onChange={(event) => setField('contentId', event.target.value)} /></Field>
            <Field label="ID guida"><input value={form.guideId} onChange={(event) => setField('guideId', event.target.value)} /></Field>
            <Field label="Link"><input value={form.link} onChange={(event) => setField('link', event.target.value)} placeholder="/guides/… oppure https://…" /></Field>
            <Field label="Territorio"><select value={form.territory} onChange={(event) => setField('territory', event.target.value)}>{['Tutti', 'Marghera', 'Monfalcone'].map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Data inizio *"><input type="date" value={form.startDate} onChange={(event) => setField('startDate', event.target.value)} required /></Field>
            <Field label="Data fine *"><input type="date" value={form.endDate} onChange={(event) => setField('endDate', event.target.value)} required /></Field>
            <Field label="Frequenza"><select value={form.frequency} onChange={(event) => setField('frequency', event.target.value)}><option value="una_volta">Una volta</option><option value="annuale">Annuale</option></select></Field>
            <Field label="Stato data"><select value={form.dateStatus} onChange={(event) => setField('dateStatus', event.target.value)}>{['Confermata', 'Da confermare', 'Evergreen'].map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Aggancio — perché questa data" wide><textarea rows="2" value={form.hook} onChange={(event) => setField('hook', event.target.value)} /></Field>
            {editing !== 'new' && <>
              <Field label="Ultimo aggiornamento"><input value={form.updatedAt || '—'} readOnly /></Field>
              <Field label="Aggiornato da"><input value={form.updatedBy || '—'} readOnly /></Field>
            </>}
          </div>
          <div className="cms-notif-language-grid">
            {LANGS.map((lang) => <label className="cms-notif-language" key={lang}>
              <span>{LANG_LABELS[lang]} <b>{lang.toUpperCase()}</b></span>
              <textarea rows="3" value={form.message?.[lang] || ''} onChange={(event) => setMessage(lang, event.target.value)} placeholder={`Messaggio in ${LANG_LABELS[lang]}`} />
              <small className={(form.message?.[lang]?.length || 0) > 180 ? 'is-long' : ''}>{form.message?.[lang]?.length || 0} / 180 caratteri</small>
            </label>)}
          </div>
          <div className="cms-notif-preview">
            <div className="cms-notif-preview-label"><Bell size={15} /> Anteprima nell’app</div>
            <p>{form.message?.it || 'Il messaggio in italiano apparirà qui.'}</p>
            <span>{dateLabel(form.startDate)} · Step2Connect</span>
          </div>
          <footer>
            {editing !== 'new' && <button type="button" className="cms-notif-delete" disabled={busy} onClick={() => remove(form)}><Trash2 size={15} /> Elimina</button>}
            <label className="cms-notif-active"><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setField('active', event.target.checked)} /> Attiva</label>
            <button type="button" className="cms-notif-button cms-notif-button--quiet" disabled={busy} onClick={closeEditor}>Annulla</button>
            <button type="submit" className="cms-notif-button cms-notif-button--primary" disabled={busy}><Save size={15} /> {busy ? 'Salvataggio…' : 'Salva notifica'}</button>
          </footer>
        </form>
      </div>}
    </section>
  );
}

function Field({ label, wide, children }) {
  return <label className={`cms-notif-field${wide ? ' is-wide' : ''}`}><span>{label}</span>{children}</label>;
}

function NotificationList({ items, busy, onEdit, onToggle }) {
  if (!items.length) return <div className="cms-notif-state"><Bell size={24} /><strong>Il calendario è ancora vuoto</strong><span>Crea una notifica o modifica i filtri per vedere altri elementi.</span></div>;
  return <div className="cms-notif-table-wrap"><table className="cms-notif-table">
    <thead><tr><th>ID</th><th>Inizio</th><th>Fine</th><th>Guida</th><th>Territorio</th><th>Attiva</th><th>Messaggio IT</th><th>Lingue</th><th>Stato data</th><th /></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}>
      <td><button type="button" className="cms-notif-id" onClick={() => onEdit(item)}>{item.id}</button></td>
      <td>{dateLabel(item.startDate)}</td><td>{dateLabel(item.endDate)}</td><td>{item.guideId || '—'}</td><td>{item.territory || 'Tutti'}</td>
      <td><button type="button" role="switch" aria-checked={Boolean(item.active)} aria-label={`${item.active ? 'Disattiva' : 'Attiva'} ${item.id}`} className={`cms-notif-switch${item.active ? ' is-on' : ''}`} onClick={() => onToggle(item)} disabled={busy}><i /></button></td>
      <td className="cms-notif-message-cell" title={item.message?.it}>{item.message?.it || '—'}</td>
      <td><div className="cms-notif-langs" aria-label="Traduzioni">{LANGS.map((lang) => <span key={lang} title={`${LANG_LABELS[lang]} ${item.message?.[lang]?.trim() ? 'presente' : 'mancante'}`} className={item.message?.[lang]?.trim() ? 'is-present' : ''}>{lang.toUpperCase()}</span>)}</div></td>
      <td><span className={`cms-notif-status status-${(item.dateStatus || '').toLowerCase().replaceAll(' ', '-')}`}>{item.dateStatus || '—'}</span></td>
      <td><button type="button" className="cms-notif-edit-link" onClick={() => onEdit(item)}>Modifica</button></td>
    </tr>)}</tbody>
  </table></div>;
}

function ImportPreview({ preview, busy, onCancel, onConfirm }) {
  const rows = preview.rows || [];
  const hasErrors = rows.some((row) => row.errors?.length);
  const eligible = rows.filter((row) => !row.skipped && row.action !== 'skip').length;
  return <section className="cms-notif-import">
    <header><div><p className="cms-eyebrow">Controllo prima del salvataggio</p><h3>Anteprima import <span>{preview.totalRows ?? rows.length} righe</span></h3></div><button type="button" aria-label="Chiudi anteprima" onClick={onCancel}><X size={18} /></button></header>
    <p className="cms-notif-import-note">Nessuna modifica è stata salvata. Controlla gli avvisi e conferma quando l’anteprima è pronta.</p>
    <div className="cms-notif-import-table"><table><thead><tr><th>Riga</th><th>ID</th><th>Esito</th><th>Messaggio IT</th><th>Controlli</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.notification?.id || '—'}</td><td><span className={`cms-notif-action action-${row.action || 'new'}`}>{row.skipped || row.action === 'skip' ? 'Saltata' : row.action === 'update' ? 'Aggiornata' : 'Nuova'}</span></td><td>{row.notification?.message?.it || '—'}</td><td>{[...(row.errors || []).map((text) => `Errore: ${text}`), ...(row.warnings || [])].map((text, index) => <span key={index} className={String(text).startsWith('Errore:') ? 'is-error' : 'is-warning'}>{text}</span>)}</td></tr>)}
    </tbody></table></div>
    <footer><span>{eligible} righe importabili{hasErrors ? ' · correggi gli errori prima di procedere' : ''}</span><button type="button" className="cms-notif-button cms-notif-button--quiet" disabled={busy} onClick={onCancel}>Annulla</button><button type="button" className="cms-notif-button cms-notif-button--primary" disabled={busy || hasErrors || eligible === 0 || preview.canConfirm === false} onClick={onConfirm}>{busy ? 'Importazione…' : 'Conferma import'}</button></footer>
  </section>;
}
