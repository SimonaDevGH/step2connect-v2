const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');

process.env.SESSION_SECRET = 'notifications-fixture-secret-not-for-real-use';
process.env.COGNITO_USER_POOL_ID = 'fixture-pool';
process.env.COGNITO_USER_POOL_CLIENT_ID = 'fixture-client';
process.env.COGNITO_REGION = 'eu-west-2';
const phone = '+390000000001';
const objects = new Map();
const profiles = new Map();
let whitelist = { accessCode: '123456', enabled: true };
const writes = [];
const updates = [];
let conflict = false;
let storageFailure = '';
function rejectStorage(operation) {
  if (storageFailure !== operation) return;
  throw Object.assign(new Error('private account details must not be returned'), {
    name: 'AccessDenied', $metadata: { httpStatusCode: 403, requestId: 'fixture-request' },
  });
}
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const storage = {
  async getJson(key) { rejectStorage('read'); return objects.has(key) ? structuredClone(objects.get(key)) : null; },
  async putJson(key, value) { rejectStorage('write'); objects.set(key, structuredClone(value)); writes.push(key); },
  async copyObject(from, to) { rejectStorage('archive'); assert.ok(objects.has(from)); objects.set(to, structuredClone(objects.get(from))); writes.push(to); },
};
const documentClient = { async send(command) {
  const input = command.input;
  if (command.constructor.name === 'ScanCommand' || command.constructor.name === 'QueryCommand') {
    const profile = profiles.get(input.ExpressionAttributeValues[':phone']);
    return { Items: profile ? [structuredClone(profile)] : [] };
  }
  if (command.constructor.name === 'UpdateCommand') {
    updates.push(input);
    const profile = [...profiles.values()].find((value) => value.userId === input.Key.userId);
    if (conflict) {
      conflict = false;
      profile.notificationsRead = [...(profile.notificationsRead || []), 'other-browser'];
      throw Object.assign(new Error('conflict'), { name: 'ConditionalCheckFailedException' });
    }
    assert.ok(profile);
    assert.match(input.ConditionExpression, /attribute_exists/);
    assert.equal(input.ExpressionAttributeValues[':phone'], profile.phone);
    profile.notificationsRead = structuredClone(input.ExpressionAttributeValues[':next']);
    return {};
  }
  throw new Error(`Unexpected command: ${command.constructor.name}`);
} };
const sdk = require('@aws-sdk/lib-dynamodb');
const originalFrom = sdk.DynamoDBDocumentClient.from;
sdk.DynamoDBDocumentClient.from = () => documentClient;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.includes('/server/')) {
    if (request === './s3' || request === '../lib/s3') return storage;
    if (request === 'jwks-rsa') return () => ({
      getSigningKey(_kid, callback) { callback(null, { getPublicKey: () => rsa.publicKey }); },
    });
    if (request === '../lib/adminUsers') return {
      findAdminByPhone: async () => ({ adminOTP: '654321' }),
      findAdminByPhoneAndOTP: async () => null,
    };
    if (request === '../lib/whitelistUsers') return {
      findWhitelistByPhone: async () => whitelist,
      matchesAccessCode: () => true,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let routes, notifications, excel, userProfiles;
try {
  routes = require('../server/routes/notifications');
  notifications = require('../server/lib/notifications');
  excel = require('../server/lib/notificationExcel');
  userProfiles = require('../server/lib/userProfiles');
} finally {
  Module._load = originalLoad;
  sdk.DynamoDBDocumentClient.from = originalFrom;
}
let server, origin;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/notifications', routes.adminRouter);
  app.use('/api/notifications', routes.userRouter);
  server = await new Promise((resolve) => { const current = app.listen(0, '127.0.0.1', () => resolve(current)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
function adminToken() {
  return jwt.sign({ kind: 'cms-admin', email: 'fixture@example.invalid' }, process.env.SESSION_SECRET, {
    issuer: 'step2connect-cms', audience: 'cms-admin', expiresIn: '5m',
  });
}
function cognitoToken() {
  return jwt.sign({ phone_number: phone, token_use: 'id' }, rsa.privateKey, {
    algorithm: 'RS256', keyid: 'fixture', issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/fixture-pool',
    audience: 'fixture-client', expiresIn: '5m',
  });
}
function previewToken(type = 'fincantieri_users') {
  const secret = crypto.createHmac('sha256', process.env.SESSION_SECRET).update('preview-admin-v1').digest('hex');
  const version = crypto.createHmac('sha256', secret).update(type === 'admin'
    ? `${phone}:654321` : `fincantieri_users:${phone}:123456`).digest('hex');
  return jwt.sign({ kind: 'preview-session', phone, type, credentialVersion: version }, secret, {
    issuer: 'step2connect-preview', audience: 'preview-admin', expiresIn: '5m',
  });
}
function seed() {
  objects.clear(); profiles.clear(); writes.length = 0; updates.length = 0;
  whitelist = { accessCode: '123456', enabled: true };
  objects.set('config/sections.json', { notifications: { status: 'published' } });
  objects.set('content/draft/guides/it/emergency.json', { id: 'emergency' });
  profiles.set(phone, { userId: 'fixture-user', phone, type: 'standard', sede: 'Monfalcone' });
}
function record(id = 'N-001', overrides = {}) {
  const { romeToday } = require('../server/lib/notificationDates');
  const today = romeToday();
  return { id, obiettivo: 'leggere_contenuti', tipo: 'content_engagement', contentId: '004',
    guideId: 'emergency', link: '/guides/health/emergency', message: { it: '📢 Messaggio', en: '', bn: '' },
    startDate: today, endDate: today, frequency: 'una_volta', active: true, territory: 'Tutti',
    dateStatus: 'Confermata', hook: '', ...overrides };
}
async function api(path, method = 'GET', body, token = adminToken()) {
  const response = await fetch(origin + path, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, data: await response.json() };
}

test('admin validation, authentication, archive-before-save and merge preserve unrelated notifications', async () => {
  seed();
  assert.deepEqual(await notifications.getCalendar(), { notifications: [] });
  assert.equal((await api('/api/admin/notifications', 'GET', null, '')).response.status, 401);
  assert.equal((await api('/api/admin/notifications', 'GET', null, cognitoToken())).response.status, 401);
  const create = await api('/api/admin/notifications/N-001', 'PUT', record());
  assert.equal(create.response.status, 200);
  assert.equal(create.data.notifications[0].updatedBy, 'fixture@example.invalid');
  const old = structuredClone(objects.get(notifications.KEY));
  await api('/api/admin/notifications/N-002', 'PUT', record('N-002'));
  assert.equal(objects.get(notifications.KEY).notifications.length, 2);
  const archives = [...objects.keys()].filter((key) => key.startsWith('config/archive/notifications_'));
  assert.equal(archives.length, 1);
  assert.deepEqual(objects.get(archives[0]), old);
  assert.ok(writes.at(-2).startsWith('config/archive/'));
  assert.equal(writes.at(-1), notifications.KEY);
  for (const values of [
    { guideId: 'not-existing' }, { message: { it: '' } }, { endDate: '2000-01-01' },
    { link: 'javascript:alert(1)' }, { link: '//example.invalid' }, { active: 'TRUE' },
  ]) {
    assert.equal((await api('/api/admin/notifications/N-003', 'PUT', record('N-003', values))).response.status, 400);
  }
  const count = writes.length;
  assert.equal((await api('/api/admin/notifications/import/confirm', 'POST', { notifications: [record(), record()] })).response.status, 400);
  assert.equal(writes.length, count);
  assert.equal((await api('/api/admin/notifications/N-002', 'DELETE')).data.notifications.length, 1);
});

test('Rome boundaries, territory, Italian fallback, ordering and strict dates', () => {
  const { romeToday, validDate } = require('../server/lib/notificationDates');
  assert.equal(romeToday(new Date('2027-01-03T23:30:00Z')), '2027-01-04');
  assert.equal(romeToday(new Date('2027-07-03T22:30:00Z')), '2027-07-04');
  assert.equal(validDate('2027-02-30'), false);
  const calendar = { notifications: [
    record('old', { startDate: '2027-01-01', endDate: '2027-01-04' }),
    record('new', { startDate: '2027-01-04', endDate: '2027-01-05' }),
    record('local', { startDate: '2027-01-04', endDate: '2027-01-05', territory: 'Marghera' }),
    record('inactive', { active: false }), record('future', { startDate: '2028-01-01', endDate: '2028-01-02' }),
  ] };
  const items = notifications.visibleNotifications(calendar, { sede: ' MONFALCONE ', notificationsRead: ['new'] }, 'bn', '2027-01-04');
  assert.deepEqual(items.map((item) => item.id), ['new', 'old']);
  assert.equal(items[0].message, '📢 Messaggio');
  assert.equal(items[0].read, true);
  assert.equal(notifications.visibleNotifications(calendar, null, 'it', '2027-01-04').length, 2);
  assert.equal(notifications.visibleNotifications(calendar, { sede: 'marghera' }, 'it', '2027-01-04').length, 3);
});

test('import confirmation identifies the failed storage step without replacing the active calendar or exposing AWS details', async () => {
  seed();
  await notifications.saveNotifications([record()], 'fixture');
  const old = structuredClone(objects.get(notifications.KEY));
  try {
    for (const step of ['read', 'archive', 'write']) {
      storageFailure = step;
      const result = await api('/api/admin/notifications/import/confirm', 'POST', {
        notifications: [record('N-002')],
      });
      assert.equal(result.response.status, 500);
      assert.equal(result.data.code, `NOTIFICATIONS_${step.toUpperCase()}_FAILED`);
      assert.match(result.data.reference, /^[0-9a-f-]{36}$/);
      assert.ok(result.data.error.includes('permessi AWS S3'));
      assert.ok(!JSON.stringify(result.data).includes('private account details'));
      assert.deepEqual(objects.get(notifications.KEY), old);
    }
  } finally { storageFailure = ''; }
  // A failed queued save must not prevent a subsequent legitimate retry.
  const retry = await api('/api/admin/notifications/import/confirm', 'POST', { notifications: [record('N-002')] });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.data.imported, 1);
});

test('uploaded November calendar previews and confirms all 45 rows against isolated storage', {
  skip: !fs.existsSync('attached_assets/S2C_calendario_notifiche_20261110_1794322344659.xlsx'),
}, async () => {
  seed();
  const buffer = fs.readFileSync('attached_assets/S2C_calendario_notifiche_20261110_1794322344659.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Calendario');
  const headers = new Map();
  sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.value), column));
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const guideId = row.getCell(headers.get('ID guida CMS')).text.trim();
    if (guideId) objects.set(`content/draft/guides/it/${guideId}.json`, { id: guideId });
  });
  const preview = await excel.previewImport(buffer);
  assert.equal(preview.totalRows, 45);
  assert.equal(preview.canConfirm, true);
  assert.ok(preview.rows.every((row) => !row.errors.length));
  await notifications.saveNotifications([record('existing')], 'fixture');
  const old = structuredClone(objects.get(notifications.KEY));
  const result = await api('/api/admin/notifications/import/confirm', 'POST', {
    notifications: preview.rows.filter((row) => !row.skipped).map((row) => row.notification),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.imported, 45);
  assert.equal(result.data.notifications.length, 46);
  const archives = [...objects.entries()].filter(([key]) => key.startsWith('config/archive/notifications_'));
  assert.ok(archives.some(([, value]) => JSON.stringify(value) === JSON.stringify(old)));
});

test('real Cognito and preview signatures, revoked credentials and CMS tokens cannot cross user authentication', async () => {
  seed();
  await notifications.saveNotifications([record()], 'fixture');
  for (const token of ['', 'bad-token', adminToken()]) {
    assert.equal((await api('/api/notifications', 'GET', null, token)).response.status, 401);
  }
  assert.equal((await api('/api/notifications', 'GET', null, cognitoToken())).data.unread, 1);
  const profile = profiles.get(phone);
  profile.type = 'fincantieri_users';
  const token = previewToken();
  assert.equal((await api('/api/notifications?lang=bn', 'GET', null, token)).data.items[0].message, '📢 Messaggio');
  whitelist = null;
  assert.equal((await api('/api/notifications', 'GET', null, token)).response.status, 401);
  profile.type = 'admin'; profile.adminPsw = true;
  assert.equal((await api('/api/notifications', 'GET', null, previewToken('admin'))).response.status, 200);
  profile.adminPsw = false;
  assert.equal((await api('/api/notifications', 'GET', null, previewToken('admin'))).response.status, 401);
});

test('read state persists through new sessions, stays on existing user, merges conflicts and keeps last 300 ids', async () => {
  seed();
  await notifications.saveNotifications([record(), record('N-002', { territory: 'Marghera' })], 'fixture');
  const token = cognitoToken();
  const read = await api('/api/notifications/read?lang=bn', 'POST', { ids: ['N-001', 'N-002', 'unknown'] }, token);
  assert.equal(read.response.status, 200);
  assert.equal(read.data.unread, 0);
  assert.deepEqual(profiles.get(phone).notificationsRead, ['N-001']);
  assert.equal((await api('/api/notifications', 'GET', null, cognitoToken())).data.unread, 0);
  assert.equal((await api('/api/notifications/read', 'POST', { ids: 'N-001' }, token)).response.status, 400);
  conflict = true;
  profiles.get(phone).notificationsRead = Array.from({ length: 300 }, (_, i) => `past-${i}`);
  const saved = await userProfiles.markNotificationsReadByPhone(phone, ['N-001']);
  assert.equal(saved.length, 300);
  assert.ok(saved.includes('other-browser'));
  assert.equal(saved.at(-1), 'N-001');
  assert.equal(profiles.get(phone).type, 'standard');
  assert.equal((await api('/api/notifications/read-all', 'POST', {}, token)).data.unread, 0);
  profiles.delete(phone);
  const absent = await api('/api/notifications/read', 'POST', { ids: ['N-001'] }, token);
  assert.equal(absent.response.status, 200);
  assert.equal(absent.data.unread, 1);
});

test('section visibility is respected server-side for standard, preview and admin accounts', async () => {
  seed();
  await notifications.saveNotifications([record()], 'fixture');
  objects.set('config/sections.json', { notifications: { status: 'internal' } });
  assert.equal((await api('/api/notifications', 'GET', null, cognitoToken())).data.items.length, 0);
  profiles.get(phone).type = 'fincantieri_users';
  objects.set('config/sections.json', { notifications: { status: 'preview' } });
  assert.equal((await api('/api/notifications', 'GET', null, previewToken())).data.items.length, 1);
  profiles.get(phone).type = 'standard';
  assert.equal((await api('/api/notifications', 'GET', null, cognitoToken())).data.items.length, 0);
  profiles.get(phone).type = 'admin';
  objects.set('config/sections.json', { notifications: { status: 'internal' } });
  assert.equal((await api('/api/notifications', 'GET', null, cognitoToken())).data.items.length, 1);
});

const uploadedCalendar = 'attached_assets/0_S2C_calendario_notifiche_2027_V3_1793633892347.xlsx';
test('uploaded real calendar validates all 45 rows including welcome, proposed messages, target guides and required warnings', {
  skip: fs.existsSync(uploadedCalendar) ? false : 'Optional user-uploaded calendar is not part of the source repository',
}, async () => {
  seed();
  const buffer = fs.readFileSync(uploadedCalendar);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Calendario');
  for (let i = 2; i <= sheet.rowCount; i++) {
    const id = sheet.getRow(i).getCell(5).value;
    if (id) objects.set(`content/draft/guides/it/${id}.json`, { id });
  }
  const beforeWrites = writes.length;
  const preview = await excel.previewImport(buffer);
  assert.equal(writes.length, beforeWrites);
  assert.equal(preview.totalRows, 45);
  assert.equal(preview.canConfirm, true);
  const byId = new Map(preview.rows.map((row) => [row.notification.id, row]));
  assert.equal(byId.get('N-WELCOME').notification.tipo, 'welcome');
  for (let i = 2; i <= sheet.rowCount; i++) {
    const proposed = sheet.getRow(i).getCell(20).value;
    if (typeof proposed === 'string' && proposed.trim()) {
      assert.equal(byId.get(sheet.getRow(i).getCell(1).value).notification.message.it, proposed.trim());
    }
  }
  assert.equal(byId.get('N-009').notification.guideId, 'gp-registration');
  for (const id of ['N-011', 'N-042']) assert.equal(byId.get(id).notification.guideId, 'emergency');
  for (const id of ['N-015', 'N-028', 'N-034', 'N-035']) assert.ok(byId.get(id).warnings.some((warning) => warning.includes('180')));
  assert.ok(byId.get('N-001').warnings.some((warning) => warning.includes('EN')));
  assert.ok(byId.get('N-001').warnings.some((warning) => warning.includes('BN')));
  await notifications.saveNotifications(preview.rows.map((row) => row.notification), 'fixture');
  const snapshot = structuredClone(objects.get(notifications.KEY));
  const exported = await excel.exportCalendar();
  const again = await excel.previewImport(exported);
  assert.equal(again.canConfirm, true);
  await notifications.saveNotifications(again.rows.map((row) => row.notification), 'fixture');
  assert.deepEqual(objects.get(notifications.KEY), snapshot);
});

test('Excel handles cached formulas, numeric dates, reordered headers, defaults, skipped rows and duplicate ids; preview never writes', async () => {
  seed();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('First');
  sheet.addRow(['Messaggio IT proposto', 'id_notifica', 'tipo_notifica', 'obiettivo', 'data_pubblicazione',
    'notifica_attiva', 'pagina', 'frequenza', 'territorio', 'Stato data', 'Approvazione', 'Messaggio IT']);
  sheet.addRow(['Proposto', 'function', 'function_engagement', 'usare_funzioni', { formula: 'DATE(2027,1,4)', result: 46391 },
    { formula: 'TRUE()', result: true }, 'https://wa.me/000', 'annuale', 'Tutti', 'Evergreen', '', 'Originale']);
  sheet.addRow(['Saltare', 'skip', 'invalid', '', 'bad date', false, '', '', '', '', 'Da eliminare']);
  const preview = await excel.previewImport(await workbook.xlsx.writeBuffer());
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.rows[0].notification.message.it, 'Proposto');
  assert.equal(preview.rows[0].notification.startDate, '2027-01-04');
  assert.equal(preview.rows[0].notification.endDate, '2027-01-18');
  assert.equal(preview.rows[0].notification.active, true);
  assert.equal(preview.rows[1].skipped, true);
  assert.ok(preview.rows[1].warnings.length);
  assert.equal(writes.length, 0);
  assert.equal(excel.dateValue('04/01/2027'), '2027-01-04');
  assert.equal(excel.dateValue(0, true), '1904-01-01');
  const form = new FormData();
  form.append('file', new Blob([await workbook.xlsx.writeBuffer()]), 'test.xlsx');
  const response = await fetch(origin + '/api/admin/notifications/import/preview', {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken()}` }, body: form,
  });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 0);
});

test('notification display keeps emoji graphemes and uses Italian calendar relative dates in three languages', async () => {
  const { splitNotificationMessage, notificationDate } = await import('../src/lib/notificationDisplay.js');
  assert.deepEqual(splitNotificationMessage('👨‍👩‍👧 Ciao'), { emoji: '👨‍👩‍👧', text: 'Ciao' });
  assert.deepEqual(splitNotificationMessage('Messaggio'), { emoji: '', text: 'Messaggio' });
  for (const lang of ['it', 'en', 'bn']) {
    const dictionary = (await import(`../src/i18n/${lang}.js`)).default;
    const t = (key) => dictionary[key];
    const now = new Date('2027-01-03T23:30:00Z');
    assert.equal(notificationDate('2027-01-04', t, lang, now), t('notifToday'));
    assert.equal(notificationDate('2027-01-03', t, lang, now), t('notifYesterday'));
    assert.equal(notificationDate('2027-01-01', t, lang, now), t('notifDaysAgo').replace('{count}', new Intl.NumberFormat(lang).format(3)));
  }
});
