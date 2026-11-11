const ExcelJS = require('exceljs');
const { getEditor, prepareQuiz } = require('./quiz');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
function text(cell) {
  const v = cell.value;
  if (v && typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '').trim();
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    return String(v.text || '').trim();
  }
  return String(v ?? '').trim();
}
async function previewExcel(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Quiz 3 lingue') || book.worksheets[0];
  if (!sheet) throw Object.assign(new Error('Foglio Excel assente'), { status: 400 });
  if (sheet.rowCount > 5001) throw Object.assign(new Error('Massimo 5000 righe'), { status: 400 });
  const cols = new Map();
  sheet.getRow(1).eachCell((cell, i) => cols.set(normalize(text(cell)), i));
  const grouped = new Map();
  const errors = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const value = (name) => cols.has(normalize(name)) ? text(row.getCell(cols.get(normalize(name)))) : '';
    if (!row.values.some((v) => v !== null && v !== undefined && v !== '')) continue;
    const guideId = value('ID guida CMS');
    const answer = normalize(value('Risposta'));
    const q = { qid: value('Domanda'), answer: answer === 'vero' ? true : answer === 'falso' ? false : null, anchor: value('Paragrafo') };
    if (!guideId) { errors.push(`Riga ${i}: ID guida CMS mancante`); continue; }
    if (!grouped.has(guideId)) grouped.set(guideId, {
      id: `quiz-${guideId}`, guideId, contentId: value('ID contenuto'), questions: [],
      translations: Object.fromEntries(['it', 'en', 'bn'].map((lang) => [lang, { questions: [] }])),
    });
    const record = grouped.get(guideId);
    if (value('ID contenuto') !== record.contentId) errors.push(`Riga ${i}: ID contenuto incoerente per ${guideId}`);
    record.questions.push(q);
    for (const lang of ['it', 'en', 'bn']) record.translations[lang].questions.push({
      qid: q.qid, statement: value(`Affermazione ${lang}`), explanation: value(`Spiegazione ${lang}`),
    });
  }
  const quizzes = [];
  for (const record of grouped.values()) {
    const entry = { id: record.id, guideId: record.guideId, action: 'new', errors: [], warnings: [], record };
    try {
      const previous = await getEditor(record.id);
      entry.action = previous ? 'update' : 'new';
      // An untouched export must retain an order deliberately changed in the CMS.
      // Otherwise the incoming file is normalized by qid.
      if (!previous || JSON.stringify(previous.questions.map((q) => q.qid)) !== JSON.stringify(record.questions.map((q) => q.qid))) {
        record.questions.sort((a, b) => a.qid.localeCompare(b.qid, undefined, { numeric: true }));
      }
      record.passThreshold = Math.min(previous?.passThreshold || 3, record.questions.length);
      // Excel contains text, not audio: preserve existing per-language media.
      for (const lang of ['it', 'en', 'bn']) {
        for (const q of record.translations[lang].questions) {
          const old = previous?.translations?.[lang]?.questions?.find((v) => v.qid === q.qid);
          q.audioUrl = old?.audioUrl || '';
          q.explanationAudioUrl = old?.explanationAudioUrl || '';
        }
      }
      const result = await prepareQuiz(record, { importing: true });
      record.visibility = result.records[0].visibility;
      entry.warnings = result.warnings;
    } catch (err) {
      if (!err.status) throw err;
      entry.errors.push(err.message);
    }
    quizzes.push(entry);
  }
  if (!quizzes.length && !errors.length) errors.push('Nessuna domanda importabile');
  return { quizzes, errors, warnings: quizzes.flatMap((q) => q.warnings), canConfirm: quizzes.length > 0 && !errors.length && quizzes.every((q) => !q.errors.length) };
}
async function exportExcel(records) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Quiz 3 lingue');
  const headers = ['ID contenuto', 'ID guida CMS', 'Domanda', 'Risposta', 'Paragrafo',
    'Affermazione IT', 'Spiegazione IT', 'Affermazione EN', 'Spiegazione EN', 'Affermazione BN', 'Spiegazione BN'];
  sheet.addRow(headers);
  for (const record of records) {
    for (const q of record.questions) {
      sheet.addRow([record.contentId, record.guideId, q.qid, q.answer ? 'Vero' : 'Falso', q.anchor,
        ...['it', 'en', 'bn'].flatMap((lang) => {
          const text = record.translations[lang].questions.find((v) => v.qid === q.qid);
          return [text?.statement || '', text?.explanation || ''];
        })]);
    }
  }
  sheet.columns.forEach((column, index) => { column.width = index < 5 ? 24 : 60; });
  return book.xlsx.writeBuffer();
}
module.exports = { previewExcel, exportExcel };
