const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { generateKeyPairSync } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const {
  recordPrivacyConsentByPhone, formatPrivacyAcceptedAt,
} = require('../server/lib/userProfiles');

const PHONE = '+393000000001';
const CLICK = '2026-11-10T16:38:49.123Z';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

async function harness(t) {
  const state = {
    profile: { userId: 'crm-key-not-cognito-sub', phone: PHONE, type: 'standard',
      firstName: 'Fixture', company: 'Fixture company', quizResults: { existing: { score: 4 } } },
    updates: [], scans: [],
  };
  const client = { async send(command) {
    const x = command.input;
    if (command.constructor.name === 'ScanCommand') {
      state.scans.push(x);
      return { Items: state.profile?.phone === x.ExpressionAttributeValues[':phone'] ? [structuredClone(state.profile)] : [] };
    }
    assert.equal(command.constructor.name, 'UpdateCommand', 'Never replace the user record');
    state.updates.push(x);
    assert.equal(x.Key.userId, 'crm-key-not-cognito-sub');
    assert.equal(x.UpdateExpression, 'SET #consent = :true, #acceptedAt = if_not_exists(#acceptedAt, :acceptedAt)');
    assert.match(x.ConditionExpression, /attribute_exists\(userId\).*#phone = :phone/);
    assert.match(x.ConditionExpression, /attribute_not_exists\(#consent\) OR #consent <> :true/);
    assert.equal(x.ExpressionAttributeValues[':true'], true);
    if (state.failure) throw new Error('Sensitive AWS details must not be logged');
    if (state.race) {
      state.profile.privacy_policy_consent = true;
      state.profile.privacyAcceptedAt = '20261110 16:37';
    }
    if (!state.profile || state.profile.privacy_policy_consent === true
      || state.profile.phone !== x.ExpressionAttributeValues[':phone']) {
      const error = new Error('Conditional update failed');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }
    state.profile.privacy_policy_consent = true;
    state.profile.privacyAcceptedAt ??= x.ExpressionAttributeValues[':acceptedAt'];
    return { Attributes: { privacy_policy_consent: true, privacyAcceptedAt: state.profile.privacyAcceptedAt } };
  } };
  const previous = {};
  const configuration = {
    COGNITO_REGION: 'eu-west-2', COGNITO_USER_POOL_ID: 'eu-west-2_fixture',
    COGNITO_USER_POOL_CLIENT_ID: 'fixture-client',
  };
  for (const [key, value] of Object.entries(configuration)) {
    previous[key] = process.env[key]; process.env[key] = value;
  }
  const original = Module._load;
  let router;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === 'jwks-rsa') return () => ({
        getSigningKey(kid, callback) { callback(null, { getPublicKey: () => publicKey }); },
      });
      if (request === '../lib/userProfiles') return {
        ...original.call(this, request, parent, isMain),
        recordPrivacyConsentByPhone: (phone, at) => recordPrivacyConsentByPhone(phone, at, client),
      };
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve('../server/middleware/auth')];
    delete require.cache[require.resolve('../server/routes/users')];
    router = require('../server/routes/users');
  } finally { Module._load = original; }
  const app = express();
  app.use(express.json());
  app.use('/api/users', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const key of Object.keys(configuration)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  });
  const token = (claims = {}) => jwt.sign({
    sub: 'different-cognito-sub', phone_number: PHONE, token_use: 'id', ...claims,
  }, privateKey, {
    algorithm: 'RS256', keyid: 'fixture', issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_fixture',
    audience: 'fixture-client', expiresIn: '5m',
  });
  const api = async (body, auth = token()) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/users/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { state, api, token };
}

test('consent requires a real Cognito ID JWT; body cannot select the user', async (t) => {
  const h = await harness(t);
  const body = { privacy_policy_consent: true, privacyAcceptedAt: CLICK };
  assert.equal((await h.api(body, null)).status, 401);
  assert.equal((await h.api(body, 'invalid')).status, 401);
  assert.equal((await h.api(body, jwt.sign({ phone: PHONE }, 'preview-fixture'))).status, 401);
  assert.equal((await h.api(body, h.token({ token_use: 'access' }))).status, 401);
  assert.equal((await h.api({ ...body, phone: PHONE }, h.token({ phone_number: undefined }))).status, 403);
  const result = await h.api({ ...body, phone: '+393999999999', userId: 'someone-else' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, privacy_policy_consent: true, privacyAcceptedAt: '20261110 16:38' });
  assert.equal(h.state.updates[0].ExpressionAttributeValues[':phone'], PHONE);
  assert.equal(h.state.scans[0].ExpressionAttributeValues[':phone'], PHONE);
  assert.equal(h.state.profile.firstName, 'Fixture');
  assert.deepEqual(h.state.profile.quizResults, { existing: { score: 4 } });
});

test('consent keeps the first acceptance, including concurrent requests', async (t) => {
  const h = await harness(t);
  const body = { privacy_policy_consent: true, privacyAcceptedAt: CLICK };
  await h.api(body);
  const next = await h.api({ ...body, privacyAcceptedAt: '2026-11-10T16:45:00.000Z' });
  assert.equal(next.body.privacyAcceptedAt, '20261110 16:38');
  assert.equal(h.state.updates.length, 1);
  delete h.state.profile.privacy_policy_consent;
  delete h.state.profile.privacyAcceptedAt;
  h.state.race = true;
  const raced = await h.api(body);
  assert.equal(raced.status, 200);
  assert.equal(raced.body.privacyAcceptedAt, '20261110 16:37');
});

test('consent rejects false/invalid timestamps and never creates a missing profile', async (t) => {
  const h = await harness(t);
  for (const value of [false, 'true', undefined]) {
    assert.equal((await h.api({ privacy_policy_consent: value, privacyAcceptedAt: CLICK })).status, 400);
  }
  for (const value of ['', '20261110 16:38', '2026-02-30T16:38:49.123Z', '2999-01-01T00:00:00.000Z']) {
    assert.equal((await h.api({ privacy_policy_consent: true, privacyAcceptedAt: value })).status, 400);
  }
  assert.equal(h.state.updates.length, 0);
  h.state.profile = null;
  assert.equal((await h.api({ privacy_policy_consent: true, privacyAcceptedAt: CLICK })).status, 404);
  assert.equal(h.state.updates.length, 0);
  assert.equal(formatPrivacyAcceptedAt(CLICK), '20261110 16:38');
});

test('consent storage errors log no personal data or AWS error contents', async (t) => {
  const h = await harness(t);
  h.state.failure = true;
  const logs = [], original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const result = await h.api({ privacy_policy_consent: true, privacyAcceptedAt: CLICK });
    assert.equal(result.status, 500);
    assert.deepEqual(logs, [['[users] privacy consent save failed']]);
    assert.equal(h.state.profile.privacy_policy_consent, undefined);
  } finally { console.error = original; }
});

test('registration waits for successful profile sync, retries consent once, and never saves on login', async () => {
  const { syncProfileAfterLogin } = await import('../src/lib/registrationConsent.js');
  const calls = [], logs = [];
  let resolveSync;
  const pending = new Promise(resolve => { resolveSync = resolve; });
  const options = {
    isRegister: true, idToken: 'fixture-id-token', profile: { firstName: 'Fixture' },
    consent: { privacy_policy_consent: true, privacyAcceptedAt: CLICK },
    syncProfile: async (token, profile, settings) => { calls.push(['sync', settings]); await pending; },
    savePrivacyConsent: async (token, consent) => { calls.push(['save', consent.privacyAcceptedAt]); },
    warn: message => logs.push(message),
  };
  const completed = syncProfileAfterLogin(options);
  assert.deepEqual(calls, [['sync', { requireSuccess: true }]]);
  resolveSync(); await completed;
  assert.deepEqual(calls[1], ['save', CLICK]);
  calls.length = 0;
  await syncProfileAfterLogin({ ...options, isRegister: false });
  assert.deepEqual(calls, [['sync', { requireSuccess: false }]]);
  calls.length = 0;
  await syncProfileAfterLogin({ ...options, syncProfile: async () => { throw new Error(PHONE); } });
  assert.equal(calls.length, 0);
  assert.deepEqual(logs, ['[privacy-consent] profile sync failed; consent not saved']);
  logs.length = 0;
  let attempts = 0;
  await syncProfileAfterLogin({ ...options,
    savePrivacyConsent: async () => { attempts++; throw new Error(PHONE); },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(logs, ['[privacy-consent] save failed after two attempts']);
  logs.length = 0; attempts = 0;
  await syncProfileAfterLogin({ ...options,
    savePrivacyConsent: async () => { if (++attempts === 1) throw new Error('retry'); },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(logs, []);
});
