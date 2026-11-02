const { getJson, putJson, listKeys } = require('./s3');
const sanitizeHtml = require('sanitize-html');
const LANGS = ['it', 'en', 'bn'];
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const key = (stage, lang, id) => `content/${stage}/quiz/${lang}/${id}.json`;

// Matches first-level rendered elements, not nested list entries or inline tags.
function guideParagraphs(html = '') {
  const result = [];
  const tokens = String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let depth = 0;
  let current = '';
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (/^<\//.test(token)) {
      depth = Math.max(0, depth - 1);
      current += token;
      if (!depth) {
        result.push({ anchor: `p${result.length + 1}`, text: sanitizeHtml(current, { allowedTags: [], allowedAttributes: {} }) });
        current = '';
      }
    } else if (/^</.test(token)) {
      const voidTag = /^<(br|hr|img|input|source|wbr|embed|area|base|col|link|meta)\b/i.test(token) || /\/>$/.test(token);
      current += token;
      if (!voidTag) depth++;
      else if (!depth) {
        result.push({ anchor: `p${result.length + 1}`, text: '' });
        current = '';
      }
    } else if (depth) current += token;
  }
  return result;
}

async function getEditor(id) {
  if (!safeId(id)) fail('ID quiz non valido');
  const records = await Promise.all(LANGS.map(async (lang) =>
    await getJson(key('draft', lang, id)) || await getJson(key('published', lang, id))));
  const base = records[0] || records.find(Boolean);
  if (!base) return null;
  const guide = await getJson(`content/draft/guides/it/${base.guideId}.json`);
  return {
    ...base,
    questions: base.questions.map(({ qid, answer, anchor }) => ({ qid, answer, anchor })),
    translations: Object.fromEntries(LANGS.map((lang, i) => [lang, {
      title: records[i]?.title || '',
      questions: records[i]?.questions || [],
    }])),
    guideParagraphs: guideParagraphs(guide?.body),
  };
}

async function prepareQuiz(input, { importing = false } = {}) {
  if (!safeId(input?.guideId)) fail('ID guida non valido');
  const id = `quiz-${input.guideId}`;
  if (!safeId(id) || (input.id && input.id !== id)) fail('ID quiz deve essere quiz- seguito da ID guida');
  const guides = await Promise.all(LANGS.map((lang) => getJson(`content/draft/guides/${lang}/${input.guideId}.json`)));
  if (!guides[0]) fail(`Guida inesistente nel CMS: ${input.guideId}`);
  const previous = await getEditor(id);
  if (!Array.isArray(input.questions) || !input.questions.length || input.questions.length > 100) fail('Inserire da 1 a 100 domande');
  const seen = new Set();
  const questions = input.questions.map((q) => {
    if (!safeId(q.qid) || seen.has(q.qid)) fail(`qid duplicato o non valido: ${q.qid}`);
    seen.add(q.qid);
    if (typeof q.answer !== 'boolean') fail(`Risposta non valida: ${q.qid}`);
    if (!/^p[1-9]\d*$/.test(q.anchor)) fail(`Paragrafo non valido: ${q.qid}`);
    return { qid: q.qid, answer: q.answer, anchor: q.anchor };
  });
  const threshold = Number(input.passThreshold ?? previous?.passThreshold ?? Math.min(3, questions.length));
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > questions.length) fail('Soglia di superamento non valida');
  const visibility = importing ? (previous?.visibility || 'internal') : (input.visibility || previous?.visibility || 'internal');
  if (!['internal', 'preview', 'published'].includes(visibility)) fail('Visibilità non valida');
  const records = LANGS.map((lang, index) => {
    const localized = input.translations?.[lang]?.questions || [];
    const guide = guides[index] || guides[0];
    return {
      id, type: 'quiz', lang, contentId: String(input.contentId ?? previous?.contentId ?? ''),
      guideId: input.guideId, guideUrl: guide.url?.startsWith('/') && !guide.url.startsWith('//')
        ? guide.url : `/guides/${guide.category}/${guide.id}`,
      category: guide.category, sortOrder: Number(guide.sortOrder) || 0,
      title: guide.title || '', visibility, passThreshold: threshold,
      questions: questions.map((q) => {
        const text = localized.find((value) => value.qid === q.qid) || {};
        if (lang === 'it' && (!text.statement?.trim() || !text.explanation?.trim())) fail(`Testo IT mancante: ${q.qid}`);
        for (const field of ['audioUrl', 'explanationAudioUrl']) {
          if (text[field] && (!/^https:\/\//.test(text[field]) && !/^\/(?!\/)/.test(text[field]))) fail('URL audio non valido');
        }
        return {
          ...q, statement: String(text.statement || '').trim(), explanation: String(text.explanation || '').trim(),
          audioUrl: String(text.audioUrl || ''), explanationAudioUrl: String(text.explanationAudioUrl || ''),
        };
      }),
    };
  });
  const warnings = [];
  if (questions.length !== 4) warnings.push(`${id}: numero domande diverso da 4`);
  const paragraphs = guideParagraphs(guides[0].body);
  for (const q of questions) {
    if (Number(q.anchor.slice(1)) > paragraphs.length) warnings.push(`${id} ${q.qid}: ancora oltre i paragrafi della guida`);
  }
  for (const record of records.slice(1)) {
    if (record.questions.some((q) => !q.statement || !q.explanation)) warnings.push(`${id}: traduzioni ${record.lang.toUpperCase()} mancanti`);
  }
  return { records, previous, warnings };
}

// Keep audit and files untouched when export -> import makes no content change.
function withoutAudit(value) {
  const { updatedAt, updatedBy, guideParagraphs: _paragraphs, ...rest } = value || {};
  return rest;
}
async function savePrepared(prepared, author) {
  const now = new Date().toISOString();
  for (const record of prepared.records) {
    const old = await getJson(key('draft', record.lang, record.id));
    if (JSON.stringify(withoutAudit(old)) === JSON.stringify(record)) continue;
    await putJson(key('draft', record.lang, record.id), { ...record, updatedAt: now, updatedBy: author });
  }
}
async function publishedQuizzes(lang = 'it') {
  if (!LANGS.includes(lang)) lang = 'it';
  const keys = await listKeys('content/published/quiz/it/');
  const items = await Promise.all(keys.filter((k) => k.endsWith('.json')).map(async (k) => {
    const it = await getJson(k);
    if (!it) return null;
    const localized = lang === 'it' ? it : await getJson(key('published', lang, it.id));
    return { ...it, title: localized?.title || it.title, questions: it.questions.map((q) => {
      const translated = localized?.questions?.find((v) => v.qid === q.qid);
      return { ...q, statement: translated?.statement || q.statement, explanation: translated?.explanation || q.explanation,
        audioUrl: translated?.audioUrl || '', explanationAudioUrl: translated?.explanationAudioUrl || '' };
    }) };
  }));
  return items.filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
function canSee(visibility, profile) {
  return profile?.type === 'admin' || visibility === 'published'
    || (profile?.type === 'fincantieri_users' && visibility === 'preview');
}
function stars(score, total) {
  return score === total ? 3 : score / total >= 0.75 ? 2 : score / total >= 0.5 ? 1 : 0;
}
function badges(items, results) {
  return Object.fromEntries([...new Set(items.map((q) => q.category))].map((category) => [
    category, items.filter((q) => q.category === category).every((q) => Boolean(results[q.id]?.passedAt)),
  ]));
}
module.exports = { LANGS, safeId, key, fail, guideParagraphs, getEditor, prepareQuiz, savePrepared, publishedQuizzes, canSee, stars, badges };
