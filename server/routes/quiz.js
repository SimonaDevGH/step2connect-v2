const express = require('express');
const multer = require('multer');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { requireNotificationUser } = require('../middleware/notificationAuth');
const { listKeys } = require('../lib/s3');
const { getSections } = require('../lib/sections');
const quiz = require('../lib/quiz');
const excel = require('../lib/quizExcel');
const { saveQuizResultByPhone, quizResultAggregates } = require('../lib/userProfiles');
const adminRouter = express.Router();
const userRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
adminRouter.use(requireAdminJWT);
userRouter.use(requireNotificationUser);
userRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const run = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

adminRouter.post('/import/preview', upload.single('file'), run(async (req, res) => {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) return res.status(400).json({ error: 'Caricare un file .xlsx' });
  try { res.json(await excel.previewExcel(req.file.buffer)); }
  catch (err) { if (!err.status) err.status = 400; throw err; }
}));
adminRouter.post('/import/confirm', run(async (req, res) => {
  const records = req.body?.quizzes;
  if (!Array.isArray(records) || !records.length || records.length > 1000) quiz.fail('Elenco quiz non valido');
  if (new Set(records.map((r) => r?.guideId)).size !== records.length) quiz.fail('Quiz duplicati');
  // Validate the whole upload again before any write. The preview is not trusted.
  const prepared = await Promise.all(records.map((record) => quiz.prepareQuiz(record, { importing: true })));
  for (const record of prepared) await quiz.savePrepared(record, adminUserId(req));
  res.json({ ok: true, count: prepared.length });
}));
adminRouter.get('/export', run(async (_req, res) => {
  const keys = [...new Set([
    ...await listKeys('content/draft/quiz/it/'),
    ...await listKeys('content/published/quiz/it/'),
  ].filter((k) => k.endsWith('.json')).map((k) => k.split('/').pop().slice(0, -5)))];
  const records = (await Promise.all(keys.sort().map(quiz.getEditor))).filter(Boolean);
  const buffer = await excel.exportExcel(records);
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="quiz-IT-EN-BN.xlsx"');
  res.send(Buffer.from(buffer));
}));
adminRouter.get('/:id/stats', run(async (req, res) => {
  const record = await quiz.getEditor(req.params.id);
  if (!record) return res.status(404).json({ error: 'Quiz non trovato' });
  res.json(await quizResultAggregates(record));
}));

async function visible(req) {
  const { profile } = req.notificationUser;
  const sections = await getSections();
  if (!quiz.canSee(sections.quiz.status, profile)) return [];
  return (await quiz.publishedQuizzes(req.query.lang)).filter((q) => quiz.canSee(q.visibility || 'internal', profile));
}
userRouter.get('/progress', (req, res) => res.json({ quizResults: req.notificationUser.profile?.quizResults || {} }));
userRouter.get('/', run(async (req, res) => {
  const items = await visible(req);
  const quizResults = req.notificationUser.profile?.quizResults || {};
  res.json({ items, quizResults, badges: quiz.badges(items, quizResults) });
}));
userRouter.get('/:id', run(async (req, res) => {
  const record = (await visible(req)).find((q) => q.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Quiz non trovato' });
  res.json({ quiz: record });
}));
userRouter.post('/:id/result', run(async (req, res) => {
  const items = await visible(req);
  const record = items.find((q) => q.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Quiz non trovato' });
  const answers = req.body?.answers;
  if (!answers || Array.isArray(answers) || typeof answers !== 'object'
    || Object.keys(answers).length !== record.questions.length
    || record.questions.some((q) => !Object.hasOwn(answers, q.qid) || typeof answers[q.qid] !== 'boolean')) quiz.fail('Rispondere a tutte le domande con vero/falso');
  const before = quiz.badges(items, req.notificationUser.profile?.quizResults || {});
  const result = await saveQuizResultByPhone(req.notificationUser.phone, record, answers);
  const after = quiz.badges(items, result.quizResults);
  res.json({
    ...result, stars: quiz.stars(result.score, record.questions.length),
    badgeUnlocked: Boolean(result.saved && !before[record.category] && after[record.category]),
  });
}));
function errors(err, _req, res, _next) {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status === 500) console.error('[quiz]', err);
  res.status(status).json({ error: status === 500 ? 'Impossibile completare la richiesta quiz' : err.message });
}
adminRouter.use(errors);
userRouter.use(errors);
module.exports = { adminRouter, userRouter };
