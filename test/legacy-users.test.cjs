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
  let used = false, writes = 0;
  const original = Module._load;
  let router;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === 'jwks-rsa') return () => ({ getSigningKey(_kid, cb) {
        cb(null, { getPublicKey: () => publicKey });
      } });
      if (request === '../lib/legacyUsers') return { ...legacy,
        findByToken: async token => token === TOKEN && !used ? Object.fromEntries(legacy.FIELDS.map((f, i) => [f, row('1')[i]])) : null,
        markMigrated: async id => { assert.equal(id, '1'); used = true; writes++; return true; },
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
    body: JSON.stringify({ token: TOKEN }) });
  const valid = await fetch(`${origin}/link?t=${TOKEN}`);
  assert.equal(valid.status, 200); assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(await valid.json()), ['firstName', 'lastName', 'email', 'company', 'site']);
  const missing = await fetch(`${origin}/link?t=${OTHER}`);
  assert.equal(missing.status, 404); const generic = await missing.json();
  assert.equal((await post()).status, 401);
  assert.equal((await post(jwt.sign({ phone: 'fixture' }, 'preview-secret'))).status, 401);
  assert.equal((await post(auth)).status, 200); assert.equal(writes, 1);
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
  assert.deepEqual(events, ['sync', 'complete', 'complete']); assert.deepEqual(warnings, []);
  events.length = 0;
  await syncLegacyProfileAfterLogin({ ...options, syncProfile: async () => { throw new Error(TOKEN); } });
  assert.deepEqual(events, []); assert.equal(warnings.length, 1);
  await syncLegacyProfileAfterLogin({ ...options, completeLegacyMigration: async () => { throw new Error(TOKEN); } });
  assert.equal(warnings.length, 2); assert.ok(!warnings.join('').includes(TOKEN));
});
