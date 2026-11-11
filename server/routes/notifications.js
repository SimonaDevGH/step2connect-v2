const express = require('express');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { requireNotificationUser } = require('../middleware/notificationAuth');
const { markNotificationsReadByPhone } = require('../lib/userProfiles');
const { getSections } = require('../lib/sections');
const { getCalendar, saveNotifications, deleteNotification, visibleNotifications, invalid } = require('../lib/notifications');
const { previewImport, exportCalendar } = require('../lib/notificationExcel');

const adminRouter = express.Router();
const userRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const handle = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (err) { next(err); }
};

adminRouter.use(requireAdminJWT);
adminRouter.get('/', handle(async (_req, res) => {
  res.set('Cache-Control', 'no-store').json(await getCalendar());
}));
adminRouter.get('/export', handle(async (_req, res) => {
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="S2C_calendario_notifiche.xlsx"');
  res.send(Buffer.from(await exportCalendar()));
}));
adminRouter.post('/import/preview', upload.single('file'), handle(async (req, res) => {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) throw invalid('Caricare un file .xlsx');
  res.json(await previewImport(req.file.buffer));
}));
adminRouter.post('/import/confirm', handle(async (req, res) => {
  const values = req.body?.notifications;
  const calendar = await saveNotifications(values, adminUserId(req));
  res.json({ ...calendar, imported: values.length });
}));
adminRouter.put('/:id', handle(async (req, res) => {
  if (req.body?.id && req.body.id !== req.params.id) throw invalid('ID nel percorso e nel corpo differenti');
  res.json(await saveNotifications([{ ...req.body, id: req.params.id }], adminUserId(req)));
}));
adminRouter.delete('/:id', handle(async (req, res) => {
  res.json(await deleteNotification(req.params.id, adminUserId(req)));
}));

userRouter.use(requireNotificationUser);
async function getUserItems(req) {
  const { profile } = req.notificationUser;
  const status = (await getSections()).notifications.status;
  const allowed = profile?.type === 'admin' || status === 'published'
    || (status === 'preview' && profile?.type === 'fincantieri_users');
  if (!allowed) return [];
  const lang = ['it', 'en', 'bn'].includes(req.query.lang) ? req.query.lang : 'it';
  return visibleNotifications(await getCalendar(), profile, lang);
}
function sendItems(res, notifications) {
  res.set('Cache-Control', 'no-store').json({ items: notifications, unread: notifications.filter((item) => !item.read).length });
}
userRouter.get('/', handle(async (req, res) => sendItems(res, await getUserItems(req))));
async function read(req, res, all) {
  const items = await getUserItems(req);
  if (!all && (!Array.isArray(req.body?.ids) || req.body.ids.length > 300
    || req.body.ids.some((id) => typeof id !== 'string' || id.length > 100))) throw invalid('ids non valido (massimo 300)');
  const selected = new Set(all ? items.map((item) => item.id) : req.body.ids);
  const ids = items.filter((item) => selected.has(item.id)).map((item) => item.id);
  const saved = ids.length ? await markNotificationsReadByPhone(req.notificationUser.phone, ids) : [];
  const readIds = new Set(saved);
  sendItems(res, items.map((item) => ({ ...item, read: item.read || readIds.has(item.id) })));
}
userRouter.post('/read', handle(async (req, res) => read(req, res, false)));
userRouter.post('/read-all', handle(async (req, res) => read(req, res, true)));

function errors(err, req, res, _next) {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File troppo grande (massimo 5 MB)' : 'Caricamento non valido' });
  const status = err.status === 400 || err.status === 409 ? err.status : 500;
  if (status !== 500) return res.status(status).json({ error: err.message });
  const reference = randomUUID();
  const operation = err.notificationOperation || 'process';
  // Never log raw AWS errors: messages can contain account IDs, keys or payloads.
  console.error('[notifications] request failed:', JSON.stringify({
    reference, operation, method: req.method, path: req.route?.path || '',
    error: err.name, awsStatus: err.$metadata?.httpStatusCode,
    awsRequestId: err.$metadata?.requestId,
  }));
  const messages = {
    read: 'Impossibile leggere il calendario o le guide collegate.',
    archive: 'Impossibile creare la copia di sicurezza. Il nuovo calendario non è stato salvato.',
    write: 'Impossibile salvare il calendario notifiche. La copia di sicurezza è stata conservata, se prevista.',
    process: 'Impossibile elaborare le notifiche.',
  };
  const permission = ['AccessDenied', 'AccessDeniedException'].includes(err.name)
    ? ' Verificare i permessi AWS S3 del server.' : '';
  res.status(500).json({
    error: `${messages[operation] || messages.process}${permission} Riferimento: ${reference}`,
    code: `NOTIFICATIONS_${operation.toUpperCase()}_FAILED`, reference,
  });
}
adminRouter.use(errors);
userRouter.use(errors);
module.exports = { adminRouter, userRouter };
