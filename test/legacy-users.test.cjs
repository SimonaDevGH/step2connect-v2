const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('node:crypto');
const legacy = require('../server/lib/legacyUsers');
const { parseCsv } = require('../server/lib/registrationOptions');

const TOKEN = 'a'.repeat(43);
const OTHER = 'b'.repeat(43);
function row(id, email = `${id}@example.test`, token = TOKEN) {
  const values = Object.fromEntries(legacy.FIELDS.map(field => [field, '']));
  Object.assign(values, { id, user_email: email, first_name: "D'Errico",
    last_name: 'Cognome, "Due"\nRiga', display_name: 'Nome Cognome',
    aziendadiappartenenza: 'Azienda, SPA', account_status: 'approved', ruolo: 'subscriber',
    link_univoco: `https://example.test/bentornato?t=${token}`,
    link_univoco_status: 'active', migration_status: 'not_migrated' });
  return legacy.FIELDS.map(field => values[field]);
}
const csv = rows => legacy.serializeCsv([legacy.FIELDS, ...rows]);
const source = rows => legacy.serializeCsv([legacy.ORIGINAL_FIELDS, ...rows.map(value => value.slice(0, 15))]);

test('legacy CSV round-trip preserves commas, apostrophes, quotes, newlines and original column order', () => {
  const rows = [legacy.FIELDS, row('1')];
  assert.deepEqual(parseCsv(legacy.serializeCsv(rows), ','), rows);
  assert.deepEqual(legacy.parseLegacyCsv(legacy.serializeCsv(rows)).rows, [row('1')]);
  assert.throws(() => legacy.parseLegacyCsv('id,user_email\n1,test@example.test'), /columns/);
});

test('preparation preserves original values and excludes every duplicate/invalid email without exposing links in report', async () => {
  const { prepareLegacyUsers } = await import('../scripts/prepare-legacy-users.mjs');
  const input = [row('1', 'One@example.test'), row('2', ' one@EXAMPLE.test '),
    row('3', ''), row('4', 'bad-email'), row('5', 'unique@example.test')];
  const { csv: output, report } = prepareLegacyUsers(source(input), 'https://step-2-connect-v-2.replit.app', () => TOKEN);
  const { rows } = legacy.parseLegacyCsv(output);
  rows.forEach((value, i) => assert.deepEqual(value.slice(0, 15), input[i].slice(0, 15)));
  rows.slice(0, 4).forEach(value => assert.deepEqual(value.slice(-3), ['', '', '']));
  assert.equal(rows[4][15], `https://step-2-connect-v-2.replit.app/bentornato?t=${TOKEN}`);
  assert.deepEqual(report, { totalRows: 5, rowsWithLink: 1, skippedRows: 4,
    skipped: { missingOrInvalidEmail: ['3', '4'], duplicateEmail: ['1', '2'] },
    accountStatus: { approved: 5 }, ruolo: { subscriber: 5 } });
  assert.ok(!JSON.stringify(report).includes(TOKEN));
});

test('preparation dry-run never accesses S3; conditional creation protects existing registry unless force', async () => {
  const { run } = await import('../scripts/prepare-legacy-users.mjs');
  const writes = [];
  const deps = { env: { PUBLIC_APP_URL: 'https://example.test' }, read: async () => source([row('1')]),
    print() {}, write: async () => { throw { name: 'PreconditionFailed' }; },
    forceWrite: async (...args) => writes.push(args) };
  await run(['private/export.csv', '--dry-run'], { ...deps, write: () => assert.fail('Dry-run must not write S3') });
  await assert.rejects(run(['private/export.csv'], deps), /already exists/);
  assert.equal(writes.length, 0);
  await run(['private/export.csv', '--force'], deps);
  assert.equal(writes[0][2], 'text/csv; charset=utf-8');
  await run(['private/export.csv'], { ...deps, write: async (...args) => writes.push(args) });
  assert.deepEqual(writes[1][2], { ifNoneMatch: '*' });
  await assert.rejects(run(['private/export.csv'], { ...deps, env: {} }), /PUBLIC_APP_URL/);
});

test('findByToken performs fresh reads, handles missing/used/migrated identically, and maps only public fields', async () => {
  let text = csv([row('1')]), reads = 0;
  const read = async () => { reads++; return { text, etag: '"v1"' }; };
  const found = await legacy.findByToken(TOKEN, read);
  assert.equal(found.id, '1');
  assert.deepEqual(Object.keys(legacy.publicProfile(found)), ['firstName', 'lastName', 'email', 'company', 'site']);
  assert.equal(await legacy.findByToken(OTHER, read), null);
  const used = row('1'); used[16] = 'used';
  text = csv([used]);
  assert.equal(await legacy.findByToken(TOKEN, read), null);
  used[16] = 'active'; used[17] = 'migrated'; text = csv([used]);
  assert.equal(await legacy.findByToken(TOKEN, read), null);
  assert.equal(reads, 4);
  assert.deepEqual(legacy.publicProfile({ ...found, first_name: '', last_name: '', display_name: 'Nome Due Cognomi' }),
    { firstName: 'Nome', lastName: 'Due Cognomi', email: '1@example.test', company: 'Azienda, SPA', site: '' });
  assert.equal(await legacy.findByToken(TOKEN, async () => { throw { name: 'NoSuchKey' }; }), null);
});

test('email lookup normalizes case/whitespace, rereads S3 and skips duplicate rows without links', async () => {
  const active = row('1', ' Legacy@EXAMPLE.test ');
  const migrated = row('2', 'migrated@example.test', OTHER);
  migrated[16] = 'used'; migrated[17] = 'migrated';
  const duplicate1 = row('3', 'duplicate@example.test');
  const duplicate2 = row('4', ' DUPLICATE@example.test ');
  duplicate1.splice(15, 3, '', '', ''); duplicate2.splice(15, 3, '', '', '');
  let reads = 0;
  const read = async key => {
    assert.equal(key, legacy.LEGACY_KEY); reads++;
    return { text: csv([active, migrated, duplicate1, duplicate2]), etag: '"fixture"' };
  };
  assert.deepEqual(await legacy.lookupEmail(' L E G A C Y @example.TEST ', read), {
    status: 'legacy', record: Object.fromEntries(legacy.FIELDS.map((field, i) => [field, active[i]])),
  });
  assert.deepEqual(await legacy.lookupEmail('MIGRATED@example.test', read), { status: 'migrated' });
  assert.deepEqual(await legacy.lookupEmail('absent@example.test', read), { status: 'none' });
  assert.deepEqual(await legacy.lookupEmail('duplicate@example.test', read), { status: 'none' });
  active[16] = 'used'; active[17] = 'migrated';
  assert.deepEqual(await legacy.lookupEmail('legacy@example.test', read), { status: 'migrated' });
  assert.equal(reads, 5, 'no cache: immediately sees a completed migration');
  await assert.rejects(legacy.lookupEmail('valid@example.test', async () => { throw { name: 'NoSuchKey' }; }));
});

test('registration email validation is mandatory and rejects malformed email without changing phone login', async () => {
  const { isValidEmail } = await import('../src/lib/emailValidation.js');
  for (const email of ['', ' ', 'a', 'a@', 'a@b', 'a b@example.test', 'a@@example.test', null]) {
    assert.equal(isValidEmail(email), false);
  }
  for (const email of ['fixture@example.test', "D'Errico+test@EXAMPLE.test", ' fixture@example.test ']) {
    assert.equal(isValidEmail(email), true);
  }
  for (const lang of ['it', 'en', 'bn']) {
    const { default: messages } = await import(`../src/i18n/${lang}.js`);
    for (const key of ['emailRequired', 'invalidEmail', 'legacyEmailSentNotice', 'legacyEmailSentOk', 'legacyAlreadyMigratedNotice']) {
      assert.ok(messages[key], `${lang}: ${key}`);
    }
  }
});

test('public email lookup sends without exposing tokens, throttles per row and fails closed on S3/SES errors', async t => {
  let failRead = false, failSend = false, reads = 0, sends = 0, clock = 0;
  let legacyFrom = 'legacy@step2connect.it';
  const { createLegacyEmailSender, COOLDOWN_MS } = require('../server/lib/legacyEmail');
  const sender = createLegacyEmailSender({ now: () => clock, getFrom: () => legacyFrom, send: async message => {
    sends++;
    assert.equal(message.from, 'legacy@step2connect.it');
    assert.equal(message.to, 'legacy@example.test');
    assert.ok(message.text.includes(`https://example.test/bentornato?t=${TOKEN}`));
    if (failSend) throw new Error(`private SES fixture@example.test ${TOKEN}`);
  } });
  const active = row('1', 'legacy@example.test');
  const migrated = row('2', 'migrated@example.test', OTHER);
  migrated[16] = 'used'; migrated[17] = 'migrated';
  const duplicate = row('3', 'duplicate@example.test');
  duplicate.splice(15, 3, '', '', '');
  const original = Module._load;
  let router;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === '../lib/legacyEmail') return { sendLegacyAccessEmail: sender };
      if (request === '../lib/legacyUsers') return { ...legacy,
        lookupEmail: email => legacy.lookupEmail(email, async () => {
          reads++;
          if (failRead) throw new Error(`private email fixture@example.test ${TOKEN}`);
          return { text: csv([active, migrated, duplicate]), etag: '"fixture"' };
        }),
      };
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve('../server/routes/users')];
    router = require('../server/routes/users').legacyRouter;
  } finally { Module._load = original; }
  const app = express(); app.use(express.json()); app.use('/api/legacy', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  });
  const post = email => fetch(`http://127.0.0.1:${server.address().port}/api/legacy/lookup-email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
  });
  const invalid = await post('not-an-email');
  assert.equal(invalid.status, 400); assert.equal(reads, 0);
  for (const [email, expected] of [
    [' LEGACY @Example.TEST ', { status: 'legacy_email_sent' }],
    ['migrated@example.test', { status: 'migrated' }],
    ['absent@example.test', { status: 'none' }],
    ['duplicate@example.test', { status: 'none' }],
  ]) {
    const response = await post(email);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), expected);
  }
  assert.equal(sends, 1);
  const repeated = await post('legacy@example.test');
  assert.deepEqual(await repeated.json(), { status: 'legacy_email_sent' });
  assert.equal(sends, 1, 'same row cooldown is independent of request email spelling');
  clock += COOLDOWN_MS;
  assert.equal((await post('legacy@example.test')).status, 200);
  assert.equal(sends, 2, 'delivery resumes after ten minutes');
  failRead = true;
  const originalError = console.error, logs = [];
  try {
    console.error = message => logs.push(message);
    const failed = await post('legacy@example.test');
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { error: 'Unable to verify account' });
    failRead = false; clock += COOLDOWN_MS; failSend = true;
    const sesFailure = await post('legacy@example.test');
    assert.equal(sesFailure.status, 503);
    assert.deepEqual(await sesFailure.json(), { error: 'Unable to verify account' });
  } finally { console.error = originalError; }
  assert.deepEqual(logs, ['[legacy] email lookup failed', '[legacy] email lookup failed']);
  failSend = false;
  assert.equal((await post('legacy@example.test')).status, 200, 'failed send does not consume cooldown');
  legacyFrom = undefined;
  const previousLog = console.error;
  try {
    console.error = () => {};
    const missingSender = await post('legacy@example.test');
    assert.equal(missingSender.status, 503, 'missing legacy sender fails even during cooldown');
    assert.deepEqual(await missingSender.json(), { error: 'Unable to verify account' });
  } finally { console.error = previousLog; }
  let limited;
  for (let i = 0; i < 22; i++) {
    limited = await post('absent@example.test');
    if (limited.status === 429) break;
  }
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('cache-control'), 'no-store');
});

test('legacy email is trilingual, escapes CSV values and uses the exact personal link', async () => {
  const { legacyAccessMessage, createLegacyEmailSender, COOLDOWN_MS } = require('../server/lib/legacyEmail');
  const record = { id: 'row-1', first_name: '<Nome & "Test">', user_email: ' LEGACY @Example.TEST ',
    link_univoco: `https://example.test/bentornato?t=${TOKEN}` };
  const message = legacyAccessMessage(record);
  assert.equal(message.to, 'legacy@example.test');
  for (const lang of ['it', 'en', 'bn']) assert.ok(message.html.includes(`lang="${lang}"`));
  assert.ok(message.html.includes('&lt;Nome &amp; &quot;Test&quot;&gt;'));
  assert.ok(!message.html.includes(record.first_name));
  assert.equal(message.text.split(record.link_univoco).length - 1, 3);
  assert.ok(message.text.includes('Il link è personale e non va condiviso.'));
  assert.ok(message.text.includes('This link is personal. Do not share it.'));
  let clock = 0, calls = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const send = createLegacyEmailSender({ now: () => clock, getFrom: () => 'legacy@step2connect.it',
    send: async () => { calls++; await gate; } });
  const first = send(record), concurrent = send(record);
  await Promise.resolve();
  assert.equal(calls, 1, 'coalesces concurrent requests for same row');
  release(); await Promise.all([first, concurrent]);
  clock = COOLDOWN_MS - 1; await send(record); assert.equal(calls, 1);
  clock = COOLDOWN_MS; await send(record); assert.equal(calls, 2);
  await send({ ...record, id: 'row-2' }); assert.equal(calls, 3, 'cooldown is keyed by row ID');
  const failedSender = createLegacyEmailSender({ getFrom: () => 'legacy@step2connect.it',
    send: async () => { throw new Error(TOKEN); } });
  await assert.rejects(failedSender(record), error => error.message === 'Legacy email delivery failed');
});

test('SES transport uses eu-west-2, configured sender and UTF-8 without sending real mail', async () => {
  const original = Module._load, modulePath = require.resolve('../server/lib/sendEmail');
  const cached = require.cache[modulePath], previous = process.env.SES_FROM_EMAIL;
  const commands = [];
  let sendEmail, clientConfig;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === '@aws-sdk/client-ses') return {
        SESClient: class { constructor(config) { clientConfig = config; } async send(command) { commands.push(command); return {}; } },
        SendEmailCommand: class { constructor(input) { this.input = input; } },
      };
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[modulePath];
    ({ sendEmail } = require('../server/lib/sendEmail'));
    Module._load = original;
    assert.equal(clientConfig.region, 'eu-west-2');
    delete process.env.SES_FROM_EMAIL;
    await assert.rejects(sendEmail({ to: 'recipient@example.test', subject: 'test', html: 'test' }), /SES_FROM_EMAIL/);
    assert.equal(commands.length, 0);
    process.env.SES_FROM_EMAIL = 'sender@example.test';
    await sendEmail({ to: 'recipient@example.test', subject: 'test', html: '<p>বাংলা</p>', text: 'বাংলা' });
    assert.equal(commands[0].input.Source, 'sender@example.test');
    assert.deepEqual(commands[0].input.Destination, { ToAddresses: ['recipient@example.test'] });
    assert.equal(commands[0].input.Message.Body.Text.Charset, 'UTF-8');
    await sendEmail({ to: 'recipient@example.test', subject: 'legacy', html: '<p>Test</p>',
      from: 'legacy@step2connect.it' });
    assert.equal(commands[1].input.Source, 'legacy@step2connect.it');
    await sendEmail({ to: 'recipient@example.test', subject: 'admin reset', html: '<p>Test</p>' });
    assert.equal(commands[2].input.Source, 'sender@example.test', 'admin reset keeps SES_FROM_EMAIL');
  } finally {
    Module._load = original;
    if (cached) require.cache[modulePath] = cached; else delete require.cache[modulePath];
    if (previous === undefined) delete process.env.SES_FROM_EMAIL; else process.env.SES_FROM_EMAIL = previous;
  }
});

test('legacy sender requires LEGACY_FROM_EMAIL and never falls back to the admin sender', async () => {
  const { createLegacyEmailSender } = require('../server/lib/legacyEmail');
  const previousLegacy = process.env.LEGACY_FROM_EMAIL, previousAdmin = process.env.SES_FROM_EMAIL;
  const messages = [];
  const record = { id: 'sender-test', first_name: 'Test', user_email: 'recipient@example.test',
    link_univoco: `https://example.test/bentornato?t=${TOKEN}` };
  try {
    process.env.SES_FROM_EMAIL = 'admin@b4service.it';
    delete process.env.LEGACY_FROM_EMAIL;
    const send = createLegacyEmailSender({ send: async message => messages.push(message) });
    await assert.rejects(send(record), /Legacy sender not configured/);
    assert.equal(messages.length, 0);
    process.env.LEGACY_FROM_EMAIL = 'other@b4service.it';
    await assert.rejects(send(record), /Legacy sender not configured/);
    assert.equal(messages.length, 0);
    process.env.LEGACY_FROM_EMAIL = 'legacy@step2connect.it';
    await send(record);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].from, 'legacy@step2connect.it');
    delete process.env.LEGACY_FROM_EMAIL;
    await assert.rejects(send(record), /Legacy sender not configured/, 'no false success during cooldown');
    assert.equal(messages.length, 1);
  } finally {
    if (previousLegacy === undefined) delete process.env.LEGACY_FROM_EMAIL;
    else process.env.LEGACY_FROM_EMAIL = previousLegacy;
    if (previousAdmin === undefined) delete process.env.SES_FROM_EMAIL;
    else process.env.SES_FROM_EMAIL = previousAdmin;
  }
});

test('markMigrated retries ETag conflict, preserves concurrent changes and modifies only the selected row', async () => {
  const first = row('1'), second = row('2', 'two@example.test', OTHER);
  let text = csv([first, second]), version = 1, writes = 0;
  const read = async () => ({ text, etag: `"v${version}"` });
  const write = async (key, body, conditions) => {
    assert.equal(key, legacy.LEGACY_KEY); writes++;
    assert.deepEqual(conditions, { ifMatch: `"v${version}"` });
    if (writes === 1) {
      second[16] = 'used'; second[17] = 'migrated';
      text = csv([first, second]); version++;
      throw { $metadata: { httpStatusCode: 412 } };
    }
    text = body; version++;
  };
  assert.equal(await legacy.markMigrated('1', { read, write }), true);
  assert.equal(writes, 2);
  const result = legacy.parseLegacyCsv(text).rows;
  assert.deepEqual(result[0], [...first.slice(0, 16), 'used', 'migrated']);
  assert.deepEqual(result[1], second);
  assert.equal(await legacy.markMigrated('1', { read, write }), false);
  assert.equal(await legacy.markMigrated('missing', { read, write }), false);
  assert.equal(writes, 2);
});

test('markMigrated caps retries at five and refuses records made unusable during a conflict', async () => {
  let writes = 0;
  await assert.rejects(legacy.markMigrated('1', {
    read: async () => ({ text: csv([row('1')]), etag: '"v1"' }),
    write: async () => { writes++; throw { name: 'PreconditionFailed' }; },
  }), /conflict/);
  assert.equal(writes, 5);
  let reads = 0;
  assert.equal(await legacy.markMigrated('1', {
    read: async () => {
      const value = row('1'); if (++reads > 1) value[16] = 'used';
      return { text: csv([value]), etag: '"v1"' };
    },
    write: async () => { throw { name: 'PreconditionFailed' }; },
  }), false);
});

test('legacy routes return identical generic 404, require real Cognito JWT and reject repeat completion without writing', async t => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = { COGNITO_REGION: 'eu-west-2', COGNITO_USER_POOL_ID: 'eu-west-2_fixture', COGNITO_USER_POOL_CLIENT_ID: 'fixture-client' };
  const previous = {};
  for (const key of Object.keys(config)) { previous[key] = process.env[key]; process.env[key] = config[key]; }
  let used = false, writes = 0, typeFailure = null, consentReady = true;
  const events = [];
  const original = Module._load;
  let router;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === 'jwks-rsa') return () => ({ getSigningKey(_kid, cb) {
        cb(null, { getPublicKey: () => publicKey });
      } });
      if (request === '../lib/userProfiles') return {
        ...require('../server/lib/userProfiles'),
        setLegacyTypeByPhone: async phone => {
          assert.equal(phone, '+393000000001', 'identity comes from JWT, not body');
          events.push('type');
          if (typeFailure) throw typeFailure;
          return consentReady ? { type: 'standard_legacy' } : null;
        },
      };
      if (request === '../lib/legacyUsers') return { ...legacy,
        findByToken: async token => token === TOKEN && !used ? Object.fromEntries(legacy.FIELDS.map((f, i) => [f, row('1')[i]])) : null,
        markMigrated: async id => { assert.equal(id, '1'); events.push('csv'); used = true; writes++; return true; },
      };
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve('../server/middleware/auth')];
    delete require.cache[require.resolve('../server/routes/users')];
    router = require('../server/routes/users').legacyRouter;
  } finally { Module._load = original; }
  const app = express(); app.use(express.json()); app.use('/api/legacy', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const key of Object.keys(config)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  });
  const origin = `http://127.0.0.1:${server.address().port}/api/legacy`;
  const auth = jwt.sign({ token_use: 'id', phone_number: '+393000000001' }, privateKey, {
    algorithm: 'RS256', keyid: 'fixture', issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_fixture',
    audience: 'fixture-client', expiresIn: '5m',
  });
  const post = authorization => fetch(`${origin}/complete`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
    body: JSON.stringify({ token: TOKEN, phone: '+393999999999', type: 'admin' }) });
  const valid = await fetch(`${origin}/link?t=${TOKEN}`);
  assert.equal(valid.status, 200); assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(await valid.json()), ['firstName', 'lastName', 'email', 'company', 'site']);
  const missing = await fetch(`${origin}/link?t=${OTHER}`);
  assert.equal(missing.status, 404); const generic = await missing.json();
  assert.equal((await post()).status, 401);
  assert.equal((await post(jwt.sign({ phone: 'fixture' }, 'preview-secret'))).status, 401);
  consentReady = false;
  assert.equal((await post(auth)).status, 409); assert.equal(writes, 0);
  consentReady = true; typeFailure = new Error('fixture');
  assert.equal((await post(auth)).status, 503); assert.equal(writes, 0);
  typeFailure = null; events.length = 0;
  assert.equal((await post(auth)).status, 200); assert.equal(writes, 1);
  assert.deepEqual(events, ['type', 'csv']);
  const repeat = await post(auth);
  assert.equal(repeat.status, 404); assert.deepEqual(await repeat.json(), generic);
  const invalid = await fetch(`${origin}/link?t=${TOKEN}`);
  assert.equal(invalid.status, 404); assert.deepEqual(await invalid.json(), generic);
  assert.equal(writes, 1);
  let limited;
  for (let i = 0; i < 22; i++) {
    limited = await fetch(`${origin}/link?t=${OTHER}`);
    if (limited.status === 429) break;
  }
  assert.equal(limited.status, 429, 'IP rate limit applies even when the submitted code changes');
});

test('S3 version helpers send the exact ETag and conditional headers without changing existing helpers', async () => {
  const commands = [];
  const originalLoad = Module._load;
  const modulePath = require.resolve('../server/lib/s3');
  const originalCache = require.cache[modulePath];
  let adapter;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === '@aws-sdk/client-s3') return {
        ...originalLoad.call(this, request, parent, isMain),
        S3Client: class { async send(command) {
          commands.push(command);
          return { ETag: '"fixture-etag"', Body: require('node:stream').Readable.from([Buffer.from('csv-data')]) };
        } },
      };
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[modulePath];
    adapter = require('../server/lib/s3');
  } finally {
    Module._load = originalLoad;
    require.cache[modulePath] = originalCache;
  }
  assert.deepEqual(await adapter.getTextWithETag(legacy.LEGACY_KEY), { text: 'csv-data', etag: '"fixture-etag"' });
  assert.equal(commands[0].constructor.name, 'GetObjectCommand');
  await adapter.putTextConditional(legacy.LEGACY_KEY, 'updated-csv', { ifMatch: '"fixture-etag"' });
  assert.equal(commands[1].constructor.name, 'PutObjectCommand');
  assert.equal(commands[1].input.IfMatch, '"fixture-etag"');
  assert.equal(commands[1].input.Key, legacy.LEGACY_KEY);
  assert.equal(commands[1].input.Body, 'updated-csv');
  await adapter.putTextConditional(legacy.LEGACY_KEY, 'new-csv', { ifNoneMatch: '*' });
  assert.equal(commands[2].input.IfNoneMatch, '*');
  await assert.rejects(adapter.putTextConditional(legacy.LEGACY_KEY, 'unsafe'), /condition/);
  assert.equal(commands.length, 3);
});

test('legacy completion follows successful strict profile sync only, preserves payload and retries just once', async () => {
  const { syncLegacyProfileAfterLogin } = await import('../src/lib/legacyLogin.js');
  const profile = { phone: '+393000000001', firstName: 'Fixture', company: 'Example' };
  const events = [], warnings = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const options = { idToken: 'jwt-fixture', profile, token: TOKEN, warn: message => warnings.push(message),
    consent: { privacy_policy_consent: true, privacyAcceptedAt: '2026-11-14T14:00:00.000Z' },
    savePrivacyConsent: async (jwt, consent) => {
      assert.equal(jwt, 'jwt-fixture');
      assert.equal(consent.privacyAcceptedAt, '2026-11-14T14:00:00.000Z');
      events.push('consent');
    },
    syncProfile: async (jwt, data, opts) => {
      assert.equal(jwt, 'jwt-fixture'); assert.deepEqual(data, profile);
      assert.deepEqual(opts, { requireSuccess: true }); events.push('sync'); await gate;
    },
    completeLegacyMigration: async (jwt, token) => {
      assert.equal(jwt, 'jwt-fixture'); assert.equal(token, TOKEN); events.push('complete');
      if (events.filter(e => e === 'complete').length === 1) throw new Error(TOKEN);
    } };
  const pending = syncLegacyProfileAfterLogin(options);
  assert.deepEqual(events, ['sync']);
  release(); await pending;
  assert.deepEqual(events, ['sync', 'consent', 'complete', 'complete']); assert.deepEqual(warnings, []);
  events.length = 0;
  await syncLegacyProfileAfterLogin({ ...options, syncProfile: async () => { throw new Error(TOKEN); } });
  assert.deepEqual(events, []); assert.equal(warnings.length, 1);
  await syncLegacyProfileAfterLogin({ ...options, completeLegacyMigration: async () => { throw new Error(TOKEN); } });
  assert.equal(warnings.length, 2); assert.ok(!warnings.join('').includes(TOKEN));
  events.length = 0;
  await syncLegacyProfileAfterLogin({ ...options, savePrivacyConsent: async () => {
    events.push('consent-failed'); throw new Error(TOKEN);
  } });
  assert.deepEqual(events, ['sync', 'consent-failed', 'consent-failed']);
  assert.equal(warnings.length, 3);
});

test('legacy type assignment requires saved consent and atomically preserves other roles and identities', async () => {
  const { setLegacyTypeByPhone, isStandardProfile } = require('../server/lib/userProfiles');
  const phone = '+393000000001';
  for (const type of [undefined, '', 'standard', 'standard_legacy']) {
    let writes = 0;
    const profile = { userId: 'crm-id', phone, privacy_policy_consent: true, privacyAcceptedAt: '20261114 14:00' };
    if (type !== undefined) profile.type = type;
    assert.equal(isStandardProfile(profile), true);
    const client = { async send(command) {
      if (command.constructor.name === 'ScanCommand') return { Items: [profile] };
      writes++;
      assert.equal(command.constructor.name, 'UpdateCommand');
      const { ConditionExpression: condition, ExpressionAttributeValues: values } = command.input;
      assert.match(condition, /attribute_exists\(userId\).*#phone = :phone/);
      assert.match(condition, /#consent = :true/);
      assert.match(condition, /attribute_not_exists\(#type\).*#type = :empty.*#type = :standard.*#type = :legacy/);
      assert.equal(values[':legacy'], 'standard_legacy');
      assert.equal(values[':phone'], phone);
      assert.deepEqual(command.input.Key, { userId: 'crm-id' });
      return { Attributes: { ...profile, type: 'standard_legacy' } };
    } };
    assert.equal((await setLegacyTypeByPhone(phone, client)).type, 'standard_legacy');
    assert.equal(writes, 1);
  }
  for (const overrides of [
    { type: 'admin' }, { type: 'fincantieri_users' }, { type: 'other' },
    { privacy_policy_consent: false }, { privacyAcceptedAt: '' }, { userId: undefined },
  ]) {
    const profile = { userId: 'crm-id', phone, privacy_policy_consent: true,
      privacyAcceptedAt: '20261114 14:00', ...overrides };
    assert.equal(await setLegacyTypeByPhone(phone, { async send(command) {
      assert.equal(command.constructor.name, 'ScanCommand', 'must not write protected role or missing consent');
      return { Items: [profile] };
    } }), null);
  }
  assert.equal(await setLegacyTypeByPhone(phone, { async send(command) {
    if (command.constructor.name === 'ScanCommand') return { Items: [{
      userId: 'crm-id', phone, privacy_policy_consent: true, privacyAcceptedAt: '20261114 14:00',
    }] };
    throw { name: 'ConditionalCheckFailedException' };
  } }), null, 'a concurrent role/consent change blocks closure');
});
