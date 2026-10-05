const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const express = require('express');
const { parseWhitelistUsers, findWhitelistByPhone, matchesAccessCode } = require('../server/lib/whitelistUsers');
const { isAdminProfile, isPreviewAdminProfile, isStandardProfile, promoteWhitelistUserByPhone, setUserRoleByPhone } = require('../server/lib/userProfiles');
const { findAdminByPhone, findAdminByPhoneAndOTP } = require('../server/lib/adminUsers');
const { requireAdminJWT } = require('../server/middleware/adminAuth');

const PHONE = '+393123456789';
const CODE = '001234';
const ENTRY = { phone: PHONE, accessCode: CODE, firstName: 'Test', lastName: 'User', company: 'ELIS', enabled: 'true', notes: '' };

// Real HTTP, JWT, rate middleware and CSV/code checks; no requests to live AWS.
async function harness(t, profile) {
  const state = { profile, users: [{ ...ENTRY }], admins: [], promotions: 0 };
  const documentClient = { async send(command) {
    if (command.constructor.name === 'ScanCommand') return { Items: state.profile ? [state.profile] : [] };
    assert.equal(command.constructor.name, 'UpdateCommand');
    assert.equal(command.input.ConditionExpression,
      '#phone = :phone AND (attribute_not_exists(#type) OR #type = :empty OR #type = :standard)');
    assert.equal(command.input.ExpressionAttributeValues[':empty'], '');
    assert.equal(command.input.ExpressionAttributeValues[':standard'], 'standard');
    if (state.profile?.phone !== command.input.ExpressionAttributeValues[':phone']
      || !isStandardProfile(state.profile)) {
      const err = new Error('Condition failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    }
    state.profile = { ...state.profile, type: command.input.ExpressionAttributeValues[':type'] };
    state.promotions++;
    return { Attributes: state.profile };
  } };
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === '../lib/userProfiles') return {
      getUserByPhone: async () => state.profile,
      isAdminProfile, isPreviewAdminProfile, isStandardProfile,
      promoteWhitelistUserByPhone: () => promoteWhitelistUserByPhone(PHONE, documentClient),
    };
    if (request === '../lib/whitelistUsers') return {
      findWhitelistByPhone: (phone) => findWhitelistByPhone(phone, async () => {
        if (state.whitelistError) throw state.whitelistError;
        return state.users;
      }),
      matchesAccessCode,
    };
    if (request === '../lib/adminUsers') return {
      findAdminByPhone: (phone) => findAdminByPhone(phone, async () => state.admins),
      findAdminByPhoneAndOTP: (phone, code) => findAdminByPhoneAndOTP(phone, code, async () => state.admins),
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  let router;
  try {
    delete require.cache[require.resolve('../server/routes/users')];
    router = require('../server/routes/users');
  } finally {
    Module._load = originalLoad;
  }
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'whitelist-test-secret-only';
  const app = express();
  app.use(express.json());
  app.use('/api/users', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
  const api = async (path, body, token) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/users${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() };
  };
  const verify = async (code = CODE) => {
    const { body } = await api('/preview-admin', { phone: PHONE });
    return api('/preview-admin/verify', { phone: PHONE, code, challenge: body.challenge, type: 'admin' });
  };
  return { state, api, verify };
}

test('CSV quotes, escaped quotes, normalized phones and leading-zero string codes', async () => {
  const rows = parseWhitelistUsers('\uFEFFphone,accessCode,firstName,lastName,company,enabled,notes\r\n"+39 312 345 6789","001234","Name","Last","ELIS",true,"note, with ""quotes"""\r\n');
  assert.equal(rows[0].phone, PHONE);
  assert.equal(rows[0].accessCode, '001234');
  assert.equal(rows[0].notes, 'note, with "quotes"');
  let reads = 0;
  const loader = async () => { reads++; return rows; };
  const row = await findWhitelistByPhone('00393123456789', loader);
  assert.equal(matchesAccessCode(row, CODE), true);
  assert.equal(matchesAccessCode(row, 1234), false);
  assert.equal(matchesAccessCode(row, '1234'), false);
  await findWhitelistByPhone(PHONE, loader);
  assert.equal(reads, 2);
  for (const value of ['false', 'TRUE', '1', '', 'yes']) {
    rows[0].enabled = value;
    assert.equal(await findWhitelistByPhone(PHONE, loader), null);
  }
  assert.throws(() => parseWhitelistUsers('phone,accessCode\nx,001234'), /columns/);
  assert.throws(() => parseWhitelistUsers(
    'phone,accessCode,firstName,lastName,company,enabled,notes\n'
    + `${PHONE},001234,,,,true,\n${PHONE},001235,,,,true,\n`
  ), /duplicate/);
});

test('registered whitelist user gets a 30-day non-admin session without Cognito or SMS', async (t) => {
  const { state, api, verify } = await harness(t, { userId: 'test', phone: PHONE, type: 'standard', firstName: 'Registered' });
  const status = await api('/account-status', { phone: PHONE });
  assert.deepEqual(status.body, { exists: true, flow: 'personal-code' });
  assert.equal(JSON.stringify(status.body).includes(CODE), false);
  const result = await verify();
  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'fincantieri_users');
  assert.equal(result.body.isAdmin, false);
  assert.equal(state.profile.type, 'fincantieri_users');
  assert.equal(state.promotions, 1);
  const payload = jwt.decode(result.body.token);
  assert.equal(payload.type, 'fincantieri_users');
  assert.equal(payload.exp - payload.iat, 30 * 24 * 60 * 60);
  const restored = await api('/preview-admin/session', null, result.body.token);
  assert.equal(restored.body.type, 'fincantieri_users');
  assert.equal(restored.body.phone, PHONE);
  assert.equal(restored.body.company, 'ELIS');
  assert.equal(restored.body.firstName, 'Registered');
  assert.equal('accessCode' in restored.body, false);
  let cmsAccepted = false;
  const res = { status(code) { this.code = code; return this; }, json() {} };
  requireAdminJWT({ headers: { authorization: `Bearer ${result.body.token}` } }, res, () => { cmsAccepted = true; });
  assert.equal(cmsAccepted, false);
  assert.equal(res.code, 401);

  const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
  let smsCalls = 0;
  const flow = await beginPhoneLogin({
    mode: 'login', phone: PHONE,
    getPhoneAccountStatus: async () => status.body,
    checkPreviewAdmin: async () => (await api('/preview-admin', { phone: PHONE })).body,
    requestOTP: async () => { smsCalls++; },
  });
  assert.equal(flow.kind, 'personal-access-code');
  assert.equal(smsCalls, 0);
  const failed = await beginPhoneLogin({
    mode: 'login', phone: PHONE,
    getPhoneAccountStatus: async () => status.body,
    checkPreviewAdmin: async () => false,
    requestOTP: async () => { smsCalls++; },
  });
  assert.equal(failed.kind, 'error');
  assert.equal(smsCalls, 0);
});

test('removed, disabled or changed codes revoke sessions and disabled whitelist uses Cognito', async (t) => {
  const { state, api, verify } = await harness(t, { userId: 'test', phone: PHONE, type: 'fincantieri_users' });
  const result = await verify();
  for (const rows of [[], [{ ...ENTRY, enabled: 'false' }], [{ ...ENTRY, accessCode: '009999' }]]) {
    state.users = rows;
    assert.equal((await api('/preview-admin/session', null, result.body.token)).status, 401);
    assert.equal((await verify()).status, 401);
  }
  state.users = [{ ...ENTRY, enabled: 'false' }];
  const status = (await api('/account-status', { phone: PHONE })).body;
  assert.deepEqual(status, { exists: true, flow: 'cognito' });
  const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
  let smsCalls = 0;
  const flow = await beginPhoneLogin({
    mode: 'login', phone: PHONE, getPhoneAccountStatus: async () => status,
    checkPreviewAdmin: async () => { throw new Error('Must not call preview'); },
    requestOTP: async () => { smsCalls++; return { success: true }; },
  });
  assert.equal(flow.kind, 'otp');
  assert.equal(smsCalls, 1);
  state.profile = { ...state.profile, type: 'admin', adminPsw: true };
  state.users = [{ ...ENTRY }];
  assert.equal((await api('/preview-admin/session', null, result.body.token)).status, 401);
});

for (const initialType of [undefined, '']) {
  test(`profile with ${initialType === undefined ? 'absent' : 'empty'} type logs in without SMS and is promoted through DynamoDB adapter`, async (t) => {
    const profile = { userId: 'test', phone: PHONE };
    if (initialType !== undefined) profile.type = initialType;
    const { state, api, verify } = await harness(t, profile);
    const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
    let smsCalls = 0;
    const flow = await beginPhoneLogin({
      mode: 'login', phone: PHONE,
      getPhoneAccountStatus: async () => (await api('/account-status', { phone: PHONE })).body,
      checkPreviewAdmin: async () => (await api('/preview-admin', { phone: PHONE })).body,
      requestOTP: async () => { smsCalls++; return { success: true }; },
    });
    assert.equal(flow.kind, 'personal-access-code');
    assert.equal(smsCalls, 0);
    assert.equal((await verify('999999')).status, 401);
    assert.equal(state.profile.type, initialType);
    assert.equal(state.promotions, 0);
    const result = await verify();
    assert.equal(result.status, 200);
    assert.equal(result.body.type, 'fincantieri_users');
    assert.equal(result.body.isAdmin, false);
    assert.equal(state.profile.type, 'fincantieri_users');
    assert.equal(state.promotions, 1);
    assert.equal((await api('/preview-admin/session', null, result.body.token)).status, 200);
  });

  test(`profile with ${initialType === undefined ? 'absent' : 'empty'} type outside enabled whitelist stays on Cognito`, async (t) => {
    const profile = { userId: 'test', phone: PHONE };
    if (initialType !== undefined) profile.type = initialType;
    const { state, api, verify } = await harness(t, profile);
    const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
    for (const users of [[], [{ ...ENTRY, enabled: 'false' }]]) {
      state.users = users;
      const status = (await api('/account-status', { phone: PHONE })).body;
      assert.deepEqual(status, { exists: true, flow: 'cognito' });
      let smsCalls = 0;
      const flow = await beginPhoneLogin({
        mode: 'login', phone: PHONE, getPhoneAccountStatus: async () => status,
        checkPreviewAdmin: async () => { throw new Error('Must not call preview'); },
        requestOTP: async () => { smsCalls++; return { success: true }; },
      });
      assert.equal(flow.kind, 'otp');
      assert.equal(smsCalls, 1);
      assert.equal((await verify()).status, 401);
      assert.equal(state.promotions, 0);
      assert.equal(state.profile.type, initialType);
    }
  });
}

test('other explicit role values are not standard and cannot use personal codes or be promoted', async (t) => {
  for (const type of ['manager', null, false, ' standard ']) {
    await t.test(String(type), async (t) => {
      const { state, api, verify } = await harness(t, { userId: 'test', phone: PHONE, type });
      assert.deepEqual((await api('/account-status', { phone: PHONE })).body, { exists: true, flow: 'cognito' });
      assert.equal((await verify()).status, 401);
      assert.equal(state.profile.type, type);
      assert.equal(await promoteWhitelistUserByPhone(PHONE, {
        async send(command) {
          assert.equal(command.constructor.name, 'ScanCommand');
          return { Items: [state.profile] };
        },
      }), null);
    });
  }
});

test('unregistered whitelist stays on registration; normal standard login remains Cognito', async (t) => {
  const { state, api, verify } = await harness(t, null);
  const status = (await api('/account-status', { phone: PHONE })).body;
  assert.deepEqual(status, { exists: false });
  assert.equal((await verify()).status, 401);
  const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
  let registrations = 0;
  const flow = await beginPhoneLogin({
    mode: 'register', phone: PHONE, userData: { firstName: 'New' },
    getPhoneAccountStatus: async () => status,
    requestOTP: async () => { registrations++; return { success: true }; },
  });
  assert.equal(flow.kind, 'otp');
  assert.equal(registrations, 1);
  state.profile = { phone: PHONE, type: 'standard' };
  state.users = [];
  assert.deepEqual((await api('/account-status', { phone: PHONE })).body, { exists: true, flow: 'cognito' });
});

test('admin preview stays at 8h, cannot use whitelist code, and revalidates admin CSV', async (t) => {
  const { state, api, verify } = await harness(t, { userId: 'admin', phone: PHONE, type: 'admin', adminPsw: true });
  state.admins = [{ adminPhoneNumber: PHONE, adminOTP: '123456' }];
  assert.deepEqual((await api('/account-status', { phone: PHONE })).body, { exists: true, flow: 'preview' });
  assert.equal((await verify(CODE)).status, 401);
  const result = await verify('123456');
  assert.equal(result.body.type, 'admin');
  assert.equal(result.body.isAdmin, true);
  assert.equal(state.promotions, 0);
  const payload = jwt.decode(result.body.token);
  assert.equal(payload.exp - payload.iat, 8 * 60 * 60);
  assert.equal((await api('/preview-admin/session', null, result.body.token)).body.type, 'admin');
  state.admins = [];
  assert.equal((await api('/preview-admin/session', null, result.body.token)).status, 401);
  state.profile.adminPsw = false;
  assert.deepEqual((await api('/account-status', { phone: PHONE })).body, { exists: true, flow: 'cognito' });
  assert.equal((await verify()).status, 401);
});

test('personal-code verification retains rate limit and rejects mismatches/invalid challenges', async (t) => {
  const { api } = await harness(t, { userId: 'test', phone: PHONE, type: 'standard' });
  const challenge = (await api('/preview-admin', { phone: PHONE })).body.challenge;
  for (let index = 0; index < 9; index++) {
    const result = await api('/preview-admin/verify', { phone: PHONE, code: index ? '999999' : '1234', challenge });
    assert.equal(result.status, 401);
  }
  assert.equal((await api('/preview-admin/verify', { phone: PHONE, code: CODE, challenge })).status, 429);
});

test('whitelist read failure fails closed and forged challenges cannot grant sessions', async (t) => {
  const { state, api, verify } = await harness(t, { userId: 'test', phone: PHONE, type: 'standard' });
  const forged = await api('/preview-admin/verify', { phone: PHONE, code: CODE, challenge: 'invalid' });
  assert.equal(forged.status, 401);
  state.whitelistError = new Error('Whitelist unavailable');
  assert.equal((await api('/account-status', { phone: PHONE })).status, 503);
  assert.equal((await verify()).status, 401);
  assert.equal(state.promotions, 0);
});

test('automatic role promotion cannot overwrite admin, including concurrent changes', async () => {
  const commands = [];
  const standard = { phone: PHONE, userId: 'test', type: 'standard' };
  const client = { async send(command) {
    commands.push(command);
    if (command.constructor.name === 'ScanCommand') return { Items: [standard] };
    assert.match(command.input.ConditionExpression, /#type = :standard/);
    assert.equal(command.input.UpdateExpression, 'SET #type = :type');
    return { Attributes: { ...standard, type: 'fincantieri_users' } };
  } };
  assert.equal((await promoteWhitelistUserByPhone(PHONE, client)).type, 'fincantieri_users');
  for (const initialType of ['standard', undefined, '']) {
    for (const concurrentType of ['admin', 'manager']) {
      let reads = 0;
      const initial = { phone: PHONE, userId: 'test' };
      if (initialType !== undefined) initial.type = initialType;
      const raced = { async send(command) {
        if (command.constructor.name === 'ScanCommand') {
          return { Items: [reads++ ? { ...initial, type: concurrentType } : initial] };
        }
        assert.equal(command.input.ConditionExpression,
          '#phone = :phone AND (attribute_not_exists(#type) OR #type = :empty OR #type = :standard)');
        const err = new Error('Changed');
        err.name = 'ConditionalCheckFailedException';
        throw err;
      } };
      assert.equal(await promoteWhitelistUserByPhone(PHONE, raced), null);
    }
  }
  const adminOnly = { async send(command) {
    assert.equal(command.constructor.name, 'ScanCommand');
    return { Items: [{ ...standard, type: 'admin' }] };
  } };
  assert.equal(await promoteWhitelistUserByPhone(PHONE, adminOnly), null);
  const assigned = await setUserRoleByPhone(PHONE, { type: 'fincantieri_users', adminPsw: false }, {
    async send(command) {
      return command.constructor.name === 'ScanCommand'
        ? { Items: [standard] } : { Attributes: { ...standard, type: command.input.ExpressionAttributeValues[':type'] } };
    },
  });
  assert.equal(assigned.type, 'fincantieri_users');
});

test('frontend respects returned session type on login/restore and hides CMS for whitelist users', async () => {
  const { buildPreviewUser } = await import('../src/lib/previewSession.js');
  const { isCmsAdmin } = await import('../src/lib/userRoles.js');
  const user = buildPreviewUser({ ...ENTRY, type: 'fincantieri_users' });
  assert.equal(user.type, 'fincantieri_users');
  assert.equal(user.phone, PHONE);
  assert.equal(isCmsAdmin(user), false);
  assert.equal(isCmsAdmin(buildPreviewUser({ firstName: 'Admin', type: 'admin' })), true);
  assert.equal(buildPreviewUser({ type: 'invalid' }), null);
  const auth = fs.readFileSync('src/context/AuthContext.jsx', 'utf8');
  assert.match(auth, /setUser\(buildPreviewUser\(previewProfile\)\)/);
  assert.match(auth, /setUser\(buildPreviewUser\(previewSession\)\)/);
  const login = fs.readFileSync('src/pages/LoginPage.jsx', 'utf8');
  assert.match(login, /!otpMeta\.isRegister && !otpMeta\.isPersonalCode/);
  for (const lang of ['it', 'en', 'bn']) {
    const strings = (await import(`../src/i18n/${lang}.js`)).default;
    assert.ok(strings.personalAccessCodePrompt);
    assert.ok(strings.personalAccessCodePlaceholder);
  }
});
