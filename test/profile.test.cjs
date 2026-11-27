const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { generateKeyPairSync } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const profiles = require('../server/lib/userProfiles');

const OLD = '+393000000001';
const NEXT = '+393000000002';
const SUB = 'fixture-cognito-subject';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

async function harness(t, { stableId = SUB } = {}) {
  const profile = { userId: stableId, phone: OLD, firstName: 'Fixture', lastName: 'User',
    email: 'fixture@example.invalid', company: 'Fixture company', site: 'Fixture site',
    type: 'standard_legacy', badges: { permanent: '2026-01-01' }, privacy_policy_consent: true };
  const state = { records: new Map([[stableId, profile]]), updates: [], scans: [], failUpdate: false };
  const client = { async send(command) {
    const x = command.input;
    switch (command.constructor.name) {
      case 'GetCommand': return { Item: structuredClone(state.records.get(x.Key.userId)) };
      case 'ScanCommand':
      case 'QueryCommand': {
        state.scans.push(x);
        if (x.FilterExpression === '#identity = :identity') {
          return { Items: structuredClone([...state.records.values()].filter(
            value => value[x.ExpressionAttributeNames['#identity']] === x.ExpressionAttributeValues[':identity'],
          )) };
        }
        const values = [...state.records.values()].filter(value => value.phone === x.ExpressionAttributeValues[':phone']
          && value.userId !== x.ExpressionAttributeValues[':id']);
        return { Items: structuredClone(values) };
      }
      case 'UpdateCommand': {
        assert.equal(x.UpdateExpression, 'SET #phone = :newPhone');
        assert.match(x.ConditionExpression, /attribute_exists\(#id\)/);
        assert.match(x.ConditionExpression, /#phone = :oldPhone OR #phone = :newPhone/);
        const value = state.records.get(x.Key.userId);
        if (state.failUpdate || !value || ![x.ExpressionAttributeValues[':oldPhone'], x.ExpressionAttributeValues[':newPhone']].includes(value.phone)
          || value.type === 'fincantieri_users') throw Object.assign(new Error('conditional'), { name: 'ConditionalCheckFailedException' });
        state.updates.push(x);
        value.phone = x.ExpressionAttributeValues[':newPhone'];
        return { Attributes: structuredClone(value) };
      }
      default: throw new Error(`Unexpected ${command.constructor.name}`);
    }
  } };
  const configuration = { COGNITO_REGION: 'eu-west-2', COGNITO_USER_POOL_ID: 'eu-west-2_fixture',
    COGNITO_USER_POOL_CLIENT_ID: 'fixture-client', SESSION_SECRET: 'profile-reference-unit-tests-only' };
  const previous = Object.fromEntries(Object.keys(configuration).map(key => [key, process.env[key]]));
  Object.assign(process.env, configuration);
  const original = Module._load;
  let router;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === 'jwks-rsa') return () => ({
        getSigningKey(kid, callback) { callback(null, { getPublicKey: () => publicKey }); },
      });
      if (request === '../lib/userProfiles') return {
        ...profiles,
        getFullUserByPhone: phone => profiles.getFullUserByPhone(phone, client),
        getUserById: id => profiles.getUserById(id, client),
        syncUserPhone: values => profiles.syncUserPhone(values, client),
      };
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve('../server/routes/users')];
    delete require.cache[require.resolve('../server/middleware/auth')];
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
  const token = (claims = {}) => jwt.sign({ sub: SUB, phone_number: OLD, phone_number_verified: true, token_use: 'id', ...claims }, privateKey, {
    algorithm: 'RS256', keyid: 'fixture', issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_fixture',
    audience: 'fixture-client', expiresIn: '5m',
  });
  const api = async (path, body, auth = token()) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/users/me/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { state, profile, token, api };
}

test('profile API exposes exactly six fields, uses JWT phone and rejects unauthenticated access', async t => {
  const h = await harness(t);
  const result = await h.api('profile');
  assert.equal(result.status, 200);
  assert.equal(result.cache, 'no-store');
  assert.deepEqual(result.body, { firstName: 'Fixture', lastName: 'User', email: 'fixture@example.invalid',
    phone: OLD, company: 'Fixture company', site: 'Fixture site' });
  assert.equal((await h.api('profile', undefined, null)).status, 401);
  assert.equal((await h.api('profile', undefined, h.token({ phone_number: undefined }))).status, 403);
  assert.equal((await h.api('profile?phone=' + NEXT)).body.phone, OLD);
  assert.equal(h.state.updates.length, 0);
});

test('phone-sync strictly requires a verified Cognito ID token', async t => {
  const h = await harness(t);
  for (const verified of [false, undefined, 'true', 1]) {
    assert.equal((await h.api('phone-sync', {}, h.token({ phone_number: NEXT, phone_number_verified: verified }))).status, 403);
  }
  assert.equal((await h.api('phone-sync', {}, null)).status, 401);
  assert.equal((await h.api('phone-sync', {}, h.token({ phone_number: NEXT, token_use: 'access' }))).status, 401);
  assert.equal(h.state.updates.length, 0);
});

test('phone-sync ignores body phone and profile IDs, updates only the JWT subject profile using UpdateCommand', async t => {
  const h = await harness(t);
  const before = structuredClone(h.profile);
  const result = await h.api('phone-sync', { phone: '+393999999999', userId: 'other-profile' }, h.token({ phone_number: NEXT }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { phone: NEXT });
  assert.deepEqual(h.profile, { ...before, phone: NEXT });
  assert.equal(h.state.updates[0].Key.userId, SUB);
});

test('phone-sync rejects a number already present on another profile, without writing', async t => {
  const h = await harness(t);
  h.state.records.set('other', { userId: 'other', phone: NEXT });
  const result = await h.api('phone-sync', {}, h.token({ phone_number: NEXT }));
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'PHONE_IN_USE');
  assert.equal(h.profile.phone, OLD);
  assert.equal(h.state.updates.length, 0);
  assert.equal(h.state.scans.at(-1).ConsistentRead, true);
});

test('different CRM key uses signed pre-change reference, never a post-change phone lookup; retries are idempotent', async t => {
  const h = await harness(t, { stableId: 'different-crm-id' });
  const context = await h.api('phone-change-context', { newPhone: NEXT, userId: 'untrusted' });
  assert.equal(context.status, 200);
  assert.equal(h.state.updates.length, 0, 'Preparing a change cannot modify CRM');
  const scansBefore = h.state.scans.length;
  for (let i = 0; i < 2; i++) {
    const result = await h.api('phone-sync', { profileReference: context.body.profileReference, phone: OLD }, h.token({ phone_number: NEXT }));
    assert.equal(result.status, 200);
  }
  assert.equal(h.profile.phone, NEXT);
  assert.equal(h.state.updates.length, 2);
  assert.ok(h.state.scans.slice(scansBefore).every(scan => scan.FilterExpression.includes('#id <> :id')
    || scan.ExpressionAttributeNames['#identity'] === 'userId'));
});

test('profile reference rejects tampering, another Cognito subject and another verified phone', async t => {
  const h = await harness(t, { stableId: 'different-crm-id' });
  const { body } = await h.api('phone-change-context', { newPhone: NEXT });
  assert.equal((await h.api('phone-sync', { profileReference: body.profileReference + 'x' }, h.token({ phone_number: NEXT }))).status, 403);
  assert.equal((await h.api('phone-sync', { profileReference: body.profileReference }, h.token({ sub: 'someone-else', phone_number: NEXT }))).status, 403);
  assert.equal((await h.api('phone-sync', { profileReference: body.profileReference }, h.token({ phone_number: '+393000000003' }))).status, 403);
  assert.equal(h.state.updates.length, 0);
});

test('personal-code profiles cannot prepare or synchronize a phone change', async t => {
  const h = await harness(t);
  h.profile.type = 'fincantieri_users';
  assert.equal((await h.api('phone-change-context', { newPhone: NEXT })).status, 403);
  assert.equal((await h.api('phone-sync', {}, h.token({ phone_number: NEXT }))).status, 403);
  assert.equal(h.state.updates.length, 0);
});

test('conditional CRM update failure does not replace or change the profile', async t => {
  const h = await harness(t);
  h.state.failUpdate = true;
  assert.equal((await h.api('phone-sync', {}, h.token({ phone_number: NEXT }))).status, 409);
  assert.equal(h.profile.phone, OLD);
  assert.equal(h.state.updates.length, 0);
});

test('phone form checks format, current number, different number and availability before requesting an SMS', async () => {
  const { preparePhoneChange } = await import('../src/lib/profilePhoneChange.js');
  const calls = [];
  const options = {
    profilePhone: OLD, subject: SUB,
    getAccountStatus: async phone => { calls.push(['lookup', phone]); return { exists: false }; },
    createContext: async phone => { calls.push(['context', phone]); return { profileReference: 'fixture-reference' }; },
    updateAttributes: async args => calls.push(['sms', args]), now: () => 100,
  };
  for (const [currentPhone, newPhone, key] of [
    ['bad', NEXT, 'profilePhoneInvalid'], [OLD, '123', 'profilePhoneInvalid'],
    ['+393000000009', NEXT, 'profileCurrentPhoneIncorrect'], [OLD, OLD, 'profilePhoneSame'],
  ]) {
    await assert.rejects(preparePhoneChange({ ...options, currentPhone, newPhone }), { messageKey: key });
    assert.equal(calls.length, 0);
  }
  await assert.rejects(preparePhoneChange({ ...options, currentPhone: OLD, newPhone: NEXT,
    getAccountStatus: async () => ({ exists: true, flow: 'cognito' }) }), { messageKey: 'profilePhoneInUse' });
  await assert.rejects(preparePhoneChange({ ...options, currentPhone: OLD, newPhone: NEXT,
    getAccountStatus: async () => null }), { messageKey: 'profilePhoneError' });
  assert.equal(calls.length, 0);
  const pending = await preparePhoneChange({ ...options, currentPhone: '+39 300 000 0001', newPhone: '+39 300 000 0002' });
  assert.deepEqual(calls.map(call => call[0]), ['lookup', 'context', 'sms']);
  assert.deepEqual(calls[2][1], { userAttributes: { phone_number: NEXT } });
  assert.equal(pending.newPhone, NEXT);
  assert.equal(pending.resendAt, 60_100);
});

test('pending phone state is isolated by Cognito subject and malformed storage is ignored', async t => {
  const { readPhoneChange, storePhoneChange } = await import('../src/lib/profilePhoneChange.js');
  const previous = global.sessionStorage;
  let stored = null;
  global.sessionStorage = { getItem: () => stored, setItem: (key, value) => { stored = value; }, removeItem: () => { stored = null; } };
  t.after(() => { if (previous === undefined) delete global.sessionStorage; else global.sessionStorage = previous; });
  const pending = { subject: SUB, oldPhone: OLD, newPhone: NEXT, profileReference: 'reference', phase: 'sync', resendAt: 123 };
  storePhoneChange(pending);
  assert.deepEqual(readPhoneChange(SUB), pending);
  assert.equal(readPhoneChange('another-subject'), null);
  stored = '{';
  assert.equal(readPhoneChange(SUB), null);
  storePhoneChange(null);
  assert.equal(stored, null);
});

test('all profile text and error messages are translated in IT, EN and BN', async () => {
  const it = (await import('../src/i18n/it.js')).default;
  const keys = Object.keys(it).filter(key => key.startsWith('profile'));
  assert.ok(keys.length > 30);
  for (const lang of ['en', 'bn']) {
    const dictionary = (await import(`../src/i18n/${lang}.js`)).default;
    for (const key of keys) assert.ok(dictionary[key]?.trim(), `${lang}: ${key}`);
    assert.ok(dictionary.profileUseNewPhone.includes('{phone}'));
  }
});
