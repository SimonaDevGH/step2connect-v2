const { randomUUID } = require('node:crypto');
const { getJson, putJson, copyObject } = require('./s3');
const { romeToday, validDate } = require('./notificationDates');

const KEY = 'config/notifications.json';
const ENUMS = {
  obiettivo: ['leggere_contenuti', 'usare_funzioni'],
  tipo: ['content_engagement', 'function_engagement', 'welcome'],
  frequency: ['una_volta', 'annuale'],
  territory: ['Tutti', 'Marghera', 'Monfalcone'],
  dateStatus: ['Confermata', 'Da confermare', 'Evergreen'],
};

function invalid(message, details) {
  return Object.assign(new Error(message), { status: 400, details });
}

async function storageStep(operation, action) {
  try { return await action(); }
  catch (err) {
    err.notificationOperation = operation;
    throw err;
  }
}

async function getCalendar() {
  const saved = await storageStep('read', () => getJson(KEY));
  if (saved === null) return { notifications: [] };
  if (!saved || !Array.isArray(saved.notifications)) throw new Error('Invalid notification configuration');
  return saved;
}

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

async function validateNotification(value, guideCache = new Map()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('Notifica non valida');
  }
  const notification = {};
  const errors = [];
  notification.id = text(value.id);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(notification.id)) errors.push('ID non valido');
  for (const [key, allowed] of Object.entries(ENUMS)) {
    notification[key] = text(value[key]);
    if (!allowed.includes(notification[key])) errors.push(`${key}: valore non valido`);
  }
  for (const key of ['contentId', 'guideId', 'link', 'startDate', 'endDate', 'hook']) {
    notification[key] = text(value[key]);
  }
  notification.message = Object.fromEntries(['it', 'en', 'bn'].map((lang) => [lang, text(value.message?.[lang])]));
  if (!notification.message.it) errors.push('Messaggio IT obbligatorio');
  if (Object.values(notification.message).some((message) => message.length > 5000)) errors.push('Messaggio troppo lungo (massimo 5000 caratteri)');
  if (typeof value.active !== 'boolean') errors.push('active deve essere un booleano');
  notification.active = value.active === true;
  const datesValid = validDate(notification.startDate) && validDate(notification.endDate);
  if (!datesValid) errors.push('Date non valide (AAAA-MM-GG)');
  else if (notification.startDate > notification.endDate) errors.push('La data di fine precede la data di inizio');
  const link = notification.link;
  let validLink = /^\/(?!\/)/.test(link) && !/[\\\s\u0000-\u001f]/.test(link);
  if (link.startsWith('https://')) {
    try { validLink = new URL(link).protocol === 'https:' && !/[\\\u0000-\u001f]/.test(link); } catch { validLink = false; }
  }
  if (!validLink) errors.push('Link non valido: usare un percorso interno o https://');
  if (notification.tipo === 'content_engagement' && !notification.guideId) errors.push('Guida CMS obbligatoria');
  if (notification.guideId) {
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(notification.guideId)) errors.push('ID guida non valido');
    else {
      if (!guideCache.has(notification.guideId)) {
        guideCache.set(notification.guideId, await storageStep('read', () =>
          getJson(`content/draft/guides/it/${notification.guideId}.json`)));
      }
      if (!guideCache.get(notification.guideId)) errors.push(`Guida CMS inesistente: ${notification.guideId}`);
    }
  }
  if (errors.length) throw invalid(errors.join('; '), errors);
  return notification;
}

// Serialize writers in this runtime; the archive must succeed before replacement.
let writeQueue = Promise.resolve();
function mutateCalendar(change, author) {
  const operation = writeQueue.then(async () => {
    const previous = await getCalendar();
    const notifications = await change(previous.notifications);
    if (JSON.stringify(notifications) === JSON.stringify(previous.notifications)) return previous;
    const updatedAt = new Date().toISOString();
    if (previous.updatedAt || previous.notifications.length || await getJson(KEY) !== null) {
      const stamp = updatedAt.replace(/[:.]/g, '-') + '_' + randomUUID();
      await storageStep('archive', () => copyObject(KEY, `config/archive/notifications_${stamp}.json`));
    }
    const next = { notifications, updatedAt, updatedBy: author };
    await storageStep('write', () => putJson(KEY, next));
    return next;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

async function saveNotifications(values, author) {
  if (!Array.isArray(values) || !values.length || values.length > 5000) throw invalid('Elenco notifiche non valido (1–5000 righe)');
  const cache = new Map();
  const validated = [];
  const ids = new Set();
  for (const value of values) {
    const notification = await validateNotification(value, cache);
    if (ids.has(notification.id)) throw invalid(`ID duplicato: ${notification.id}`);
    ids.add(notification.id);
    validated.push(notification);
  }
  return mutateCalendar((previous) => {
    const merged = new Map(previous.map((item) => [item.id, item]));
    for (const value of validated) {
      const current = merged.get(value.id);
      // Preserve audit fields on unchanged Excel round trips.
      const comparable = ({ updatedAt, updatedBy, ...item }) => item;
      if (current && JSON.stringify(comparable(current)) === JSON.stringify(value)) continue;
      merged.set(value.id, { ...value, updatedAt: new Date().toISOString(), updatedBy: author });
    }
    return [...merged.values()];
  }, author);
}

function deleteNotification(id, author) {
  return mutateCalendar((previous) => previous.filter((item) => item.id !== id), author);
}

function visibleNotifications(calendar, profile, lang = 'it', today = romeToday()) {
  const sede = text(profile?.sede).toLocaleLowerCase('it');
  const read = new Set(Array.isArray(profile?.notificationsRead) ? profile.notificationsRead : []);
  const items = calendar.notifications.filter((item) =>
    item.active === true && validDate(item.startDate) && validDate(item.endDate)
    && item.startDate <= today && today <= item.endDate
    && (item.territory === 'Tutti' || (sede && text(item.territory).toLocaleLowerCase('it') === sede))
  ).sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id));
  return items.map((item) => ({
    id: item.id, message: text(item.message?.[lang]) || text(item.message?.it),
    link: item.link, startDate: item.startDate, read: read.has(item.id),
  }));
}

module.exports = { KEY, ENUMS, invalid, getCalendar, validateNotification, saveNotifications, deleteNotification, visibleNotifications };
