const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const ExcelJS = require('exceljs');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.SESSION_SECRET = 'quiz-test-only-not-real';
const objects = new Map(), profiles = new Map();
const copy = (v) => v == null ? v : structuredClone(v);
let writes = 0, conflict = false;
const storage = {
  getJson: async (key) => copy(objects.get(key)) || null,
  putJson: async (key, value) => { writes++; objects.set(key, copy(value)); },
  listKeys: async (prefix) => [...objects.keys()].filter((k) => k.startsWith(prefix)),
  copyObject: async (src, dest) => objects.set(dest, copy(objects.get(src))),
  deleteObject: async (key) => objects.delete(key),
};
const db = { send: async (cmd) => {
  const x = cmd.input;
  if (cmd.constructor.name === 'ScanCommand') {
    if (!x.FilterExpression) return { Items: [...profiles.values()].map((p) => ({ quizResults: copy(p.quizResults) })) };
    return { Items: copy([...profiles.values()].filter((p) => p.phone === x.ExpressionAttributeValues[':phone'])) };
  }
  if (cmd.constructor.name === 'UpdateCommand') {
    const p = [...profiles.values()].find((p) => p.userId === x.Key.userId);
    assert.ok(p);
    assert.match(x.ConditionExpression, /attribute_exists/);
    assert.equal(x.ExpressionAttributeValues[':phone'], p.phone);
    assert.equal(x.UpdateExpression, 'SET #results = :next');
    if (conflict) {
      conflict = false;
      p.quizResults = { ...p.quizResults, 'quiz-other': { attempts: 1 } };
      throw Object.assign(new Error('conflict'), { name: 'ConditionalCheckFailedException' });
    }
    p.quizResults = copy(x.ExpressionAttributeValues[':next']);
    return {};
  }
  throw Error(cmd.constructor.name);
} };
const sdk = require('@aws-sdk/lib-dynamodb');
const originalFrom = sdk.DynamoDBDocumentClient.from;
sdk.DynamoDBDocumentClient.from = () => db;
const load = Module._load;
Module._load = function(request, parent, main) {
  if (parent?.filename.includes('/server/')) {
    if (request === './s3' || request === '../lib/s3') return storage;
    if (request === '../middleware/notificationAuth') return {
      requireNotificationUser: async (req, res, next) => {
        const role = req.headers.authorization?.replace('Bearer ', '');
        if (!['admin', 'standard', 'fincantieri_users', 'missing'].includes(role)) return res.status(401).json({ error: 'auth' });
        req.notificationUser = {
          phone: role === 'missing' ? '+missing' : '+fixture',
          profile: role === 'missing' ? null : { ...copy(profiles.get('+fixture')), type: role },
        };
        next();
      },
    };
  }
  return load.call(this, request, parent, main);
};
let routes, admin, content, quiz, excel, users;
try {
  routes = require('../server/routes/quiz');
  admin = require('../server/routes/admin');
  content = require('../server/routes/content');
  quiz = require('../server/lib/quiz');
  excel = require('../server/lib/quizExcel');
  users = require('../server/lib/userProfiles');
} finally { Module._load = load; sdk.DynamoDBDocumentClient.from = originalFrom; }
let server, origin;
const adminToken = () => jwt.sign({ kind: 'cms-admin', email: 'fixture@example.invalid' }, process.env.SESSION_SECRET, {
  issuer: 'step2connect-cms', audience: 'cms-admin', expiresIn: '5m',
});
before(async () => {
  const app = express(); app.use(express.json());
  app.use('/api/admin/quiz', routes.adminRouter);
  app.use('/api/admin/content', admin);
  app.use('/api/content', content);
  app.use('/api/quiz', routes.userRouter);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
async function call(path, { role = 'admin', method = 'GET', body, cms = false } = {}) {
  const response = await fetch(origin + path, { method, headers: {
    ...(role ? { Authorization: `Bearer ${cms ? adminToken() : role}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  return { status: response.status, data };
}
function guide(id, category = 'documents') {
  for (const lang of quiz.LANGS) objects.set(`content/draft/guides/${lang}/${id}.json`, {
    id, type: 'guides', lang, category, title: `${lang} guide ${id}`, sortOrder: 8,
    body: '<p>First</p><ul><li>Nested</li></ul><p>Third</p><h3>Fourth</h3><p>Fifth</p><p>Sixth</p>',
  });
}
function record(id = 'permit-request') {
  return {
    id: `quiz-${id}`, guideId: id, contentId: '001', passThreshold: 3,
    category: 'forged', title: 'Excel should not set metadata', guideUrl: 'javascript:bad', sortOrder: -100,
    questions: [1, 2, 3, 4].map((i) => ({ qid: `q${i}`, answer: i % 2 === 0, anchor: i === 2 ? 'p5' : 'p2' })),
    translations: Object.fromEntries(quiz.LANGS.map((lang) => [lang, { questions: [1, 2, 3, 4].map((i) => ({
      qid: `q${i}`, statement: `${lang} statement ${i}`, explanation: `${lang} explanation ${i}`,
    })) }])),
  };
}
function reset() {
  objects.clear(); profiles.clear(); writes = 0;
  profiles.set('+fixture', { userId: 'existing', phone: '+fixture', type: 'admin', firstName: 'Fixture' });
  guide('permit-request');
  objects.set('config/sections.json', { quiz: { status: 'published' } });
}
async function publish(id = 'quiz-permit-request') {
  const result = await call(`/api/admin/content/quiz/${id}/publish`, { cms: true, method: 'POST' });
  assert.equal(result.status, 200);
}
test('quiz editor writes three internal drafts, guide metadata is authoritative and generic public APIs cannot expose quiz', async () => {
  reset();
  assert.equal((await call('/api/quiz', { role: null })).status, 401);
  assert.equal((await call('/api/admin/quiz/export', { role: null })).status, 401);
  const saved = await call('/api/admin/content/quiz/quiz-permit-request', { cms: true, method: 'PUT', body: record() });
  assert.equal(saved.status, 200);
  for (const lang of quiz.LANGS) {
    const q = objects.get(quiz.key('draft', lang, 'quiz-permit-request'));
    assert.equal(q.visibility, 'internal');
    assert.equal(q.category, 'documents');
    assert.equal(q.title, `${lang} guide permit-request`);
    assert.equal(q.sortOrder, 8);
    assert.equal(q.guideUrl, '/guides/documents/permit-request');
    assert.deepEqual(q.questions.map(({ qid, answer, anchor }) => ({ qid, answer, anchor })), record().questions);
  }
  const editor = await call('/api/admin/content/quiz/quiz-permit-request', { cms: true });
  assert.equal(editor.data.guideParagraphs.length, 6);
  assert.equal(editor.data.guideParagraphs[4].text, 'Fifth');
  assert.equal((await call('/api/content?type=quiz')).status, 404);
  assert.equal((await call('/api/content/quiz/quiz-permit-request')).status, 404);
  await publish();
  assert.equal((await call('/api/quiz')).data.items.length, 1);
  assert.equal((await call('/api/quiz', { role: 'standard' })).data.items.length, 0);
  assert.equal((await call('/api/quiz/quiz-permit-request', { role: 'standard' })).status, 404);
  const changed = await call('/api/admin/content/quiz/quiz-permit-request/visibility', { cms: true, method: 'PUT', body: { visibility: 'preview' } });
  assert.equal(changed.status, 200);
  assert.equal((await call('/api/quiz', { role: 'fincantieri_users' })).data.items.length, 1);
  assert.equal((await call('/api/quiz', { role: 'standard' })).data.items.length, 0);
});
test('authoritative results preserve first attempt, best score, profile fields, conflict merges, progress, badge and aggregate privacy', async () => {
  reset();
  await quiz.savePrepared(await quiz.prepareQuiz(record()), 'fixture'); await publish();
  conflict = true;
  const answers = { q1: false, q2: false, q3: false, q4: false };
  const first = await call('/api/quiz/quiz-permit-request/result', { method: 'POST', body: { answers, score: 999, passed: true } });
  assert.equal(first.data.score, 2);
  assert.equal(first.data.stars, 1);
  assert.equal(first.data.passed, false);
  assert.equal(first.data.badgeUnlocked, false);
  const correct = { q1: false, q2: true, q3: false, q4: true };
  const second = await call('/api/quiz/quiz-permit-request/result', { method: 'POST', body: { answers: correct } });
  assert.equal(second.data.score, 4);
  assert.equal(second.data.stars, 3);
  assert.equal(second.data.badgeUnlocked, true);
  const p = profiles.get('+fixture');
  assert.equal(p.type, 'admin');
  assert.equal(p.firstName, 'Fixture');
  assert.ok(p.quizResults['quiz-other']);
  const progress = (await call('/api/quiz/progress')).data.quizResults['quiz-permit-request'];
  assert.deepEqual(progress.firstAnswers, { q1: true, q2: false, q3: true, q4: false });
  assert.equal(progress.firstScore, 2);
  assert.equal(progress.bestScore, 4);
  assert.equal(progress.attempts, 2);
  const stats = await call('/api/admin/quiz/quiz-permit-request/stats', { cms: true });
  assert.equal(stats.data.people, 1);
  assert.equal(stats.data.passRate, 100);
  assert.deepEqual(stats.data.questions.map((q) => q.correctRate), [100, 0, 100, 0]);
  assert.ok(!JSON.stringify(stats.data).includes('+fixture'));
  assert.ok(!JSON.stringify(stats.data).includes('existing'));
  const missing = await call('/api/quiz/quiz-permit-request/result', { role: 'missing', method: 'POST', body: { answers: correct } });
  // Internal quiz is inaccessible without the admin role; a published quiz works without a profile.
  assert.equal(missing.status, 404);
  await call('/api/admin/content/quiz/quiz-permit-request/visibility', { cms: true, method: 'PUT', body: { visibility: 'published' } });
  const unsaved = await call('/api/quiz/quiz-permit-request/result', { role: 'missing', method: 'POST', body: { answers: correct } });
  assert.equal(unsaved.data.saved, false);
  assert.equal(unsaved.data.score, 4);
  assert.equal(profiles.size, 1);
  assert.equal((await call('/api/quiz/quiz-permit-request/result', { method: 'POST', body: { answers: { q1: 'false' } } })).status, 400);
});
test('Excel preview has no writes, validation/warnings, import preserves visibility, export reimport leaves data and audit unchanged', async () => {
  reset();
  const r = record();
  await quiz.savePrepared(await quiz.prepareQuiz(r), 'fixture');
  await call('/api/admin/content/quiz/quiz-permit-request/visibility', { cms: true, method: 'PUT', body: { visibility: 'preview' } });
  const editor = await quiz.getEditor(r.id);
  const buffer = await excel.exportExcel([editor]);
  const before = JSON.stringify([...objects]), count = writes;
  const p = await excel.previewExcel(buffer);
  assert.equal(p.canConfirm, true);
  assert.equal(p.quizzes[0].action, 'update');
  assert.equal(p.quizzes[0].record.visibility, 'preview');
  assert.equal(writes, count);
  const confirm = await call('/api/admin/quiz/import/confirm', { cms: true, method: 'POST', body: { quizzes: p.quizzes.map((q) => q.record) } });
  assert.equal(confirm.status, 200);
  assert.equal(JSON.stringify([...objects]), before);
  assert.equal(writes, count);
  // Deliberate CMS reordering, threshold and media also survive an untouched export.
  const edited = await quiz.getEditor(r.id);
  edited.questions.reverse();
  edited.passThreshold = 2;
  edited.translations.bn.questions[0].audioUrl = 'https://example.invalid/quiz-bn.mp3';
  await quiz.savePrepared(await quiz.prepareQuiz(edited), 'fixture');
  const reordered = await quiz.getEditor(r.id);
  const reorderedSnapshot = JSON.stringify([...objects]);
  const reorderedPreview = await excel.previewExcel(await excel.exportExcel([reordered]));
  await call('/api/admin/quiz/import/confirm', { cms: true, method: 'POST', body: { quizzes: reorderedPreview.quizzes.map((q) => q.record) } });
  assert.equal(JSON.stringify([...objects]), reorderedSnapshot);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const s = book.worksheets[0];
  s.getCell('D2').value = 'Maybe';
  assert.equal((await excel.previewExcel(await book.xlsx.writeBuffer())).canConfirm, false);
  s.getCell('D2').value = 'Falso';
  s.getCell('E2').value = 'p999';
  s.getCell('H2').value = '';
  const warning = await excel.previewExcel(await book.xlsx.writeBuffer());
  assert.equal(warning.canConfirm, true);
  assert.ok(warning.warnings.some((w) => w.includes('ancora')));
  assert.ok(warning.warnings.some((w) => w.includes('EN')));
  s.getCell('C3').value = 'q1';
  assert.equal((await excel.previewExcel(await book.xlsx.writeBuffer())).canConfirm, false);
  // Revalidation cannot trust forged valid-looking preview data.
  const invalid = record(); invalid.questions[0].answer = 'false';
  assert.equal((await call('/api/admin/quiz/import/confirm', { cms: true, method: 'POST', body: { quizzes: [invalid] } })).status, 400);
});
const actualFile = 'attached_assets/0_S2C_quiz_IT_EN_BN_V2_1793635899600.xlsx';
test('provided V2 Excel has 28 quizzes, 112 questions and correct 022/023 mappings; all drafts internal; full roundtrip', { skip: !fs.existsSync(actualFile) }, async () => {
  reset();
  const buffer = fs.readFileSync(actualFile);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const s = book.getWorksheet('Quiz 3 lingue');
  for (let i = 2; i <= s.rowCount; i++) guide(s.getRow(i).getCell(2).text);
  const p = await excel.previewExcel(buffer);
  assert.equal(p.canConfirm, true);
  assert.equal(p.quizzes.length, 28);
  assert.ok(p.quizzes.every((q) => q.record.questions.length === 4 && !q.errors.length));
  assert.equal(p.quizzes.find((q) => q.guideId === 'gp-registration').record.contentId, '022');
  assert.equal(p.quizzes.find((q) => q.guideId === 'emergency').record.contentId, '023');
  const result = await call('/api/admin/quiz/import/confirm', { cms: true, method: 'POST', body: { quizzes: p.quizzes.map((q) => q.record) } });
  assert.equal(result.status, 200);
  const records = await Promise.all(p.quizzes.map((q) => quiz.getEditor(q.id)));
  assert.ok(records.every((q) => q.visibility === 'internal'));
  const snapshot = JSON.stringify([...objects]);
  const again = await excel.previewExcel(await excel.exportExcel(records));
  await call('/api/admin/quiz/import/confirm', { cms: true, method: 'POST', body: { quizzes: again.quizzes.map((q) => q.record) } });
  assert.equal(JSON.stringify([...objects]), snapshot);
});
