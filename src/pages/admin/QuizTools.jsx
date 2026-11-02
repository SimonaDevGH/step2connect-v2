import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, Download, FileSpreadsheet, Plus, Save, Trash2, X } from 'lucide-react';
import { GUIDE_CATEGORIES } from '../../data/guides';
import { useLanguage } from '../../context/LanguageContext';

const LANGS = ['it', 'en', 'bn'];
const EMPTY_TRANS = () => Object.fromEntries(LANGS.map((lang) => [lang, { title: '', questions: [] }]));
const authHeaders = (token, json = true) => ({ Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

function newQuestion(questions) {
  let next = 1;
  while (questions.some((question) => question.qid === `q${next}`)) next += 1;
  return {
    qid: `q${next}`,
    answer: true,
    anchor: 'p1',
    translations: Object.fromEntries(LANGS.map((lang) => [lang, { statement: '', explanation: '', audioUrl: '', explanationAudioUrl: '' }])),
  };
}

function wordCount(value) { return value.trim() ? value.trim().split(/\s+/).length : 0; }

export function QuizEditForm({ quizId, adminToken, onClose, onUnauthorized }) {
  const [record, setRecord] = useState(null);
  const [guides, setGuides] = useState([]);
  const [paragraphs, setParagraphs] = useState([]);
  const [language, setLanguage] = useState('it');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const isNew = !quizId || quizId === 'new';

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/admin/content?type=guides&lang=it', { headers: authHeaders(adminToken) }).then((r) => r.json()),
      isNew ? Promise.resolve(null) : fetch(`/api/admin/content/quiz/${encodeURIComponent(quizId)}`, { headers: authHeaders(adminToken) }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); }),
    ]).then(([guideList, data]) => {
      if (!active) return;
      setGuides(Array.isArray(guideList) ? guideList : []);
      const normalized = data && {
        ...data,
        questions: (data.questions || []).map((question) => ({
          ...question,
          translations: Object.fromEntries(LANGS.map((lng) => {
            const localized = data.translations?.[lng]?.questions?.find((entry) => entry.qid === question.qid);
            return [lng, localized || question.translations?.[lng] || { statement: '', explanation: '', audioUrl: '', explanationAudioUrl: '' }];
          })),
        })),
      };
      setRecord(normalized || { type: 'quiz', guideId: '', category: GUIDE_CATEGORIES[0]?.id || 'documents', passThreshold: 3, visibility: 'internal', questions: [], translations: EMPTY_TRANS() });
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [quizId, adminToken, isNew]);

  useEffect(() => {
    if (!record?.guideId) { setParagraphs([]); return; }
    if (Array.isArray(record.guideParagraphs) && record.guideParagraphs.length) {
      setParagraphs(record.guideParagraphs);
      return;
    }
    let active = true;
    fetch(`/api/admin/content/guides/${encodeURIComponent(record.guideId)}`, { headers: authHeaders(adminToken) })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!active) return;
        const doc = new DOMParser().parseFromString(data?.it?.body || '', 'text/html');
        setParagraphs(Array.from(doc.body.children).map((el, i) => ({ anchor: `p${i + 1}`, text: (el.textContent || '').trim() })));
      }).catch(() => { if (active) setParagraphs([]); });
    return () => { active = false; };
  }, [record?.guideId, adminToken]);

  const updateRecord = (key, value) => setRecord((prev) => ({ ...prev, [key]: value }));
  const updateQuestion = (idx, key, value, lang = null) => setRecord((prev) => {
    const questions = prev.questions.map((q, i) => i !== idx ? q : lang
      ? { ...q, translations: { ...q.translations, [lang]: { ...q.translations?.[lang], [key]: value } } }
      : { ...q, [key]: value });
    return { ...prev, questions };
  });
  const moveQuestion = (index, delta) => setRecord((prev) => {
    const questions = [...prev.questions]; const target = index + delta;
    if (target < 0 || target >= questions.length) return prev;
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return { ...prev, questions };
  });

  const save = async (publish) => {
    if (!record?.guideId) { setError('Seleziona una guida prima di salvare.'); return; }
    setBusy(true); setError(''); setNotice('');
    const guide = guides.find((entry) => entry.id === record.guideId);
    const payload = {
      ...record,
      id: quizId || `quiz-${record.guideId}`,
      type: 'quiz',
      guideUrl: record.guideUrl || guide?.url || `/guides/${record.category}/${record.guideId}`,
      questions: record.questions.map(({ qid, answer, anchor }) => ({ qid, answer, anchor })),
      translations: Object.fromEntries(LANGS.map((lng) => [lng, {
        ...(record.translations?.[lng] || {}),
        title: record.translations?.[lng]?.title || '',
        questions: record.questions.map((question) => ({ qid: question.qid, ...(question.translations?.[lng] || { statement: '', explanation: '', audioUrl: '', explanationAudioUrl: '' }) })),
      }])),
    };
    try {
      const contentId = quizId || `quiz-${record.guideId}`;
      const response = await fetch(`/api/admin/content/quiz/${encodeURIComponent(contentId)}`, {
        method: 'PUT', headers: authHeaders(adminToken), body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (publish) {
        const published = await fetch(`/api/admin/content/quiz/${encodeURIComponent(contentId)}/publish`, { method: 'POST', headers: authHeaders(adminToken) });
        const publishedData = await published.json().catch(() => ({}));
        if (!published.ok) throw new Error(publishedData.error || `HTTP ${published.status}`);
      }
      setNotice(publish ? 'Modifiche pubblicate.' : 'Bozza salvata.'); if (publish) onClose?.();
    } catch (err) { setError(err.message); if (/401|token/i.test(err.message)) onUnauthorized?.(); }
    finally { setBusy(false); }
  };

  const loadStats = async () => {
    setStatsLoading(true); setError('');
    try { const response = await fetch(`/api/admin/quiz/${encodeURIComponent(quizId)}/stats`, { headers: authHeaders(adminToken, false) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); setStats(data); }
    catch (err) { setError(err.message); }
    finally { setStatsLoading(false); }
  };

  if (!record) return <div className="quiz-admin-panel">{error ? <><p className="admin-error" role="alert">{error}</p><button onClick={onClose}>Chiudi</button></> : <><div className="quiz-admin-skeleton"/><div className="quiz-admin-skeleton"/></>}</div>;
  const selectedGuide = guides.find((entry) => entry.id === record.guideId);
  return <div className="quiz-admin-panel">
    <div className="quiz-admin-top"><div><p className="cms-eyebrow">Quiz collegato alla guida</p><h2>{isNew ? 'Nuovo quiz' : record.translations?.it?.title || quizId}</h2></div><button className="quiz-admin-close" onClick={onClose} aria-label="Chiudi"><X size={20}/></button></div>
    <div className="quiz-admin-tabs"><button className={!stats ? 'active' : ''} onClick={() => setStats(null)}>Modifica</button><button onClick={loadStats} className={stats ? 'active' : ''}><BarChart3 size={16}/> Statistiche</button></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-success" role="status">{notice}</div>}
    {stats ? <section className="quiz-stats">
      {statsLoading ? <div className="quiz-admin-skeleton"/> : <>
        <div className="quiz-stats-summary"><article><strong>{stats.people ?? 0}</strong><span>Persone hanno svolto il quiz</span></article><article><strong>{stats.passRate == null ? 'N/D' : `${Number(stats.passRate).toFixed(1)}%`}</strong><span>Quiz superati</span></article></div>
        <h3>Risposte corrette al primo tentativo</h3>
        {(stats.questions || []).map((question) => {
          const parsedRate = question.correctRate == null ? NaN : Number(question.correctRate);
          const rate = Number.isFinite(parsedRate) ? Math.max(0, Math.min(100, parsedRate)) : null;
          return (
            <div className={`quiz-stat-question ${rate !== null && rate < 60 ? 'low' : ''}`} key={question.qid}>
              <strong>{question.qid}</strong><span>{rate === null ? 'N/D' : `${rate.toFixed(1)}%`}</span>
              <span className="quiz-stat-bar" aria-label={rate === null ? 'Nessun dato' : `${rate.toFixed(1)}%`}><i style={{ width: `${rate ?? 0}%` }}/></span>
              <a href={`${question.guideUrl || record.guideUrl || ''}#${question.anchor}`} target="_blank" rel="noreferrer">Apri paragrafo ↗</a>
            </div>
          );
        })}
        {!stats.questions?.length && <p className="admin-hint">Non ci sono ancora risposte registrate.</p>}
      </>}
    </section> : <>
      <label className="admin-label">Guida collegata</label>
      {isNew ? <select className="admin-input" value={record.guideId} onChange={(e) => { const guide = guides.find((g) => g.id === e.target.value); updateRecord('guideId', e.target.value); if (guide) { updateRecord('category', guide.category || record.category); updateRecord('guideUrl', guide.url || ''); } }}>
        <option value="">Seleziona una guida…</option>{guides.map((guide) => <option value={guide.id} key={guide.id}>{guide.title || guide.id}</option>)}
      </select> : <div className="quiz-guide-readonly"><strong>{selectedGuide?.title || record.translations?.it?.title || record.guideId}</strong><a href={record.guideUrl || `/guides/${record.category}/${record.guideId}`} target="_blank" rel="noreferrer">Apri guida ↗</a></div>}
      <label className="admin-label">Soglia per superare</label><input className="admin-input quiz-threshold" type="number" min="1" max={Math.max(1, record.questions.length)} value={record.passThreshold} onChange={(e) => updateRecord('passThreshold', Number(e.target.value))}/>
      <div className="admin-lang-tabs">{LANGS.map((lng) => <button type="button" key={lng} className={`admin-lang-tab ${language === lng ? 'active' : ''}`} onClick={() => setLanguage(lng)}>{lng.toUpperCase()}</button>)}</div>
      {LANGS.map((lng) => <label key={lng} className={`quiz-title-field ${language === lng ? '' : 'hidden'}`}><span className="admin-label">Titolo · {lng.toUpperCase()}</span><input className="admin-input" value={record.translations?.[lng]?.title || ''} onChange={(e) => setRecord((prev) => ({ ...prev, translations: { ...prev.translations, [lng]: { ...prev.translations?.[lng], title: e.target.value } } }))}/></label>)}
      <div className="quiz-question-editor-list">
        {(record.questions || []).map((question, index) => {
          const translation = question.translations?.[language] || {};
          const paragraph = paragraphs.find((p) => p.anchor === question.anchor);
          return <article className="quiz-question-editor" key={question.qid}>
            <div className="quiz-question-editor-head"><strong>Domanda {index + 1}</strong><div><button type="button" onClick={() => moveQuestion(index, -1)} aria-label="Sposta su" disabled={index === 0}><ArrowUp size={17}/></button><button type="button" onClick={() => moveQuestion(index, 1)} aria-label="Sposta giù" disabled={index === record.questions.length - 1}><ArrowDown size={17}/></button><button type="button" onClick={() => updateRecord('questions', record.questions.filter((_, i) => i !== index))} aria-label="Elimina domanda"><Trash2 size={17}/></button></div></div>
            <label className="admin-label">Risposta corretta</label><div className="quiz-answer-toggle"><button className={question.answer ? 'selected yes' : ''} onClick={() => updateQuestion(index, 'answer', true)}>Vero</button><button className={!question.answer ? 'selected no' : ''} onClick={() => updateQuestion(index, 'answer', false)}>Falso</button></div>
            <label className="admin-label">Paragrafo della guida</label><select className="admin-input" value={question.anchor || 'p1'} onChange={(e) => updateQuestion(index, 'anchor', e.target.value)}>{(paragraphs.length ? paragraphs : [{ anchor: 'p1', text: 'Paragrafo 1' }]).map((p) => <option key={p.anchor} value={p.anchor}>{p.anchor} · {p.text.slice(0, 80)}</option>)}</select>
            <label className="admin-label">Affermazione · {language.toUpperCase()} <small className={wordCount(translation.statement || '') > 15 ? 'over-limit' : ''}>{wordCount(translation.statement || '')} parole</small></label>
            <textarea className="admin-input quiz-editor-textarea" value={translation.statement || ''} onChange={(e) => updateQuestion(index, 'statement', e.target.value, language)}/>
            <label className="admin-label">Spiegazione · {language.toUpperCase()} <small>{wordCount(translation.explanation || '')} parole</small></label>
            <textarea className="admin-input quiz-editor-textarea" value={translation.explanation || ''} onChange={(e) => updateQuestion(index, 'explanation', e.target.value, language)}/>
            <label className="admin-label">Audio affermazione URL</label><input className="admin-input" value={translation.audioUrl || ''} onChange={(e) => updateQuestion(index, 'audioUrl', e.target.value, language)}/>
            <label className="admin-label">Audio spiegazione URL</label><input className="admin-input" value={translation.explanationAudioUrl || ''} onChange={(e) => updateQuestion(index, 'explanationAudioUrl', e.target.value, language)}/>
          </article>;
        })}
      </div>
      <button className="quiz-add-question" onClick={() => setRecord((prev) => ({ ...prev, questions: [...prev.questions, newQuestion(prev.questions)] }))}><Plus size={18}/> Aggiungi domanda</button>
      <div className="quiz-admin-actions"><button className="admin-btn-draft" onClick={() => save(false)} disabled={busy}><Save size={17}/> Salva bozza</button><button className="admin-btn-publish" onClick={() => save(true)} disabled={busy}>Pubblica modifiche</button></div>
    </>}
  </div>;
}

export function QuizImportToolbar({ adminToken, onImported, onUnauthorized }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { t } = useLanguage();

  const previewFile = async (picked = file) => {
    if (!picked) { setError('Scegli un file Excel (.xlsx).'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData(); body.append('file', picked);
      const response = await fetch('/api/admin/quiz/import/preview', { method: 'POST', headers: authHeaders(adminToken, false), body });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setPreview(data);
    } catch (err) { setError(err.message); if (/401|token/i.test(err.message)) onUnauthorized?.(); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!preview?.canConfirm) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/quiz/import/confirm', { method: 'POST', headers: authHeaders(adminToken), body: JSON.stringify({ quizzes: preview.quizzes.map((q) => q.record) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setNotice(`${data.count} quiz importati come bozze.`); setPreview(null); setFile(null); onImported?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const exportFile = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/quiz/export', { headers: authHeaders(adminToken, false) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'Step2Connect_quiz.xlsx'; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="quiz-import-toolbar">
    <div className="quiz-import-actions">
      <label className="quiz-import-pick"><FileSpreadsheet size={17}/>{t('quizImport')}<input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}/></label>
      <button className="quiz-export-btn" onClick={exportFile} disabled={busy}><Download size={17}/>{t('quizExport')}</button>
      {file && <button className="quiz-preview-btn" onClick={() => previewFile()} disabled={busy}>{busy ? t('quizWorking') : t('quizPreviewImport')}</button>}
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    {preview && <div className="quiz-import-preview">
      <div className="quiz-preview-summary"><strong>{preview.quizzes?.length || 0} quiz</strong><span>{preview.errors?.length || 0} errori · {preview.warnings?.length || 0} avvisi</span></div>
      {(preview.errors || []).map((item, i) => <p key={`e${i}`} className="quiz-import-error">{typeof item === 'string' ? item : item.message || JSON.stringify(item)}</p>)}
      {(preview.warnings || []).map((item, i) => <p key={`w${i}`} className="quiz-import-warning">{typeof item === 'string' ? item : item.message || JSON.stringify(item)}</p>)}
      {(preview.quizzes || []).map((quiz) => <div key={quiz.id} className="quiz-preview-row"><strong>{quiz.record?.translations?.it?.title || quiz.id}</strong><span>{quiz.action}</span>{quiz.errors?.map((e, i) => <small className="quiz-import-error" key={i}>{typeof e === 'string' ? e : e.message}</small>)}{quiz.warnings?.map((w, i) => <small className="quiz-import-warning" key={i}>{typeof w === 'string' ? w : w.message}</small>)}</div>)}
      <button className="quiz-confirm-import" disabled={!preview.canConfirm || busy} onClick={confirm}>Conferma import</button><button className="quiz-cancel-import" onClick={() => setPreview(null)}>Annulla</button>
    </div>}
  </section>;
}
