const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const {
  getUserByPhone,
  isAdminProfile,
  isPreviewAdminProfile,
  setUserRoleByPhone,
} = require('../server/lib/userProfiles');
const {
  findAdminByPhone,
  findAdminByPhoneAndOTP,
} = require('../server/lib/adminUsers');
const {
  requireAdminJWT,
  CMS_TOKEN_KIND,
  CMS_TOKEN_ISSUER,
  CMS_TOKEN_AUDIENCE,
} = require('../server/middleware/adminAuth');

function loadUsersRouter(profile, {
  findCsvByPhone = async () => null,
  findCsvByPhoneAndOTP = async () => null,
} = {}) {
  const originalLoad = Module._load;
  const routes = { get: [], post: [] };
  const router = {
    get(path, ...handlers) {
      routes.get.push({ path, handlers, handler: handlers.at(-1) });
    },
    post(path, ...handlers) {
      routes.post.push({ path, handlers, handler: handlers.at(-1) });
    },
  };

  Module._load = function loadMockedModule(request, parent, isMain) {
    if (request === 'express') return { Router: () => router };
    if (request === '../middleware/auth') {
      return { requireAuth: (_req, _res, next) => next() };
    }
    if (request === '../lib/userProfiles') {
      return {
        getUserByPhone: async () => {
          if (profile instanceof Error) throw profile;
          return profile;
        },
        isAdminProfile,
        isPreviewAdminProfile,
      };
    }
    if (request === '../lib/adminUsers') {
      return {
        findAdminByPhone: findCsvByPhone,
        findAdminByPhoneAndOTP: findCsvByPhoneAndOTP,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve('../server/routes/users')];
    require('../server/routes/users');
  } finally {
    Module._load = originalLoad;
  }

  return routes;
}

function response() {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('resolved admin role is exposed to Cognito sessions, while preview needs both flags', async () => {
  assert.equal(isAdminProfile({ type: 'admin', adminPsw: false }), true);
  assert.equal(isPreviewAdminProfile({ type: 'admin', adminPsw: false }), false);
  assert.equal(isPreviewAdminProfile({ type: 'admin', adminPsw: true }), true);
  assert.equal(isAdminProfile({ type: 'standard', adminPsw: true }), false);

  const adminRoutes = loadUsersRouter(
    { type: 'admin', adminPsw: true, firstName: 'Admin' },
    { findCsvByPhone: async () => ({ adminOTP: '123456' }) },
  );
  const adminResponse = response();
  await adminRoutes.get.find(({ path }) => path === '/me').handler({
    cognitoUser: { phone_number: '+390000000001' },
  }, adminResponse);
  assert.deepEqual(adminResponse.body, { firstName: 'Admin', type: 'admin' });

  const previewResponse = response();
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'test-preview-secret';
  try {
    await adminRoutes.post.find(({ path }) => path === '/preview-admin').handler({
      body: { phone: '+390000000001' },
    }, previewResponse);
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
  assert.equal('isAdmin' in previewResponse.body, false);
  assert.equal(typeof previewResponse.body.challenge, 'string');

  const standardRoutes = loadUsersRouter({ type: 'standard', adminPsw: true });
  const standardResponse = response();
  await standardRoutes.get.find(({ path }) => path === '/me').handler({
    cognitoUser: { phone_number: '+390000000002' },
  }, standardResponse);
  assert.deepEqual(standardResponse.body, { firstName: '', type: 'standard' });

  const standardChallengeResponse = response();
  process.env.SESSION_SECRET = 'test-preview-secret';
  try {
    await standardRoutes.post.find(({ path }) => path === '/preview-admin').handler({
      body: { phone: '+390000000002' },
    }, standardChallengeResponse);
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
  assert.deepEqual(
    Object.keys(standardChallengeResponse.body),
    Object.keys(previewResponse.body),
  );
  assert.equal(typeof standardChallengeResponse.body.challenge, 'string');
});

test('CMS menu uses the resolved app role and never preview credentials', async () => {
  const source = fs.readFileSync(
    require.resolve('../src/components/SideMenu.jsx'),
    'utf8',
  );
  assert.match(source, /isCmsAdmin\(user\)/);
  assert.doesNotMatch(source, /adminPsw/);

  const roles = await import('../src/lib/userRoles.js');
  assert.equal(roles.isCmsAdmin({ type: 'admin' }), true);
  assert.equal(roles.isCmsAdmin({ type: 'standard' }), false);
  assert.equal(roles.isCmsAdmin({ type: 'admin', adminPsw: false }), true);
  assert.equal(roles.isCmsAdmin(null), false);
});

test('DynamoDB profile adapter resolves and provisions an existing admin safely', async () => {
  const phone = '+390000000003';
  let stored = {
    phone,
    userId: 'profile-3',
    firstName: 'Profile',
    type: 'standard',
    adminPsw: false,
  };
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command.constructor.name);
      if (command.constructor.name === 'ScanCommand' || command.constructor.name === 'QueryCommand') {
        return { Items: [{ ...stored }] };
      }
      if (command.constructor.name === 'UpdateCommand') {
        assert.deepEqual(command.input.Key, { userId: 'profile-3' });
        assert.equal(command.input.ConditionExpression, '#phone = :phone');
        stored = {
          ...stored,
          type: command.input.ExpressionAttributeValues[':type'],
          adminPsw: command.input.ExpressionAttributeValues[':adminPsw'],
        };
        return { Attributes: { ...stored } };
      }
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    },
  };

  const before = await getUserByPhone(phone, documentClient);
  assert.equal(before.type, 'standard');

  const after = await setUserRoleByPhone(phone, {
    type: 'admin',
    adminPsw: true,
  }, documentClient);
  assert.equal(after.type, 'admin');
  assert.equal(after.adminPsw, true);
  assert.ok(commands.includes('UpdateCommand'));
});

test('phone login prepares an opaque challenge while registration requests Cognito OTP', async () => {
  const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');
  const adminEvents = [];
  const adminFlow = await beginPhoneLogin({
    mode: 'login',
    phone: '+390000000004',
    userData: {},
    getPhoneAccountStatus: async () => {
      adminEvents.push('account-check');
      return { exists: true, flow: 'preview' };
    },
    checkPreviewAdmin: async () => {
      adminEvents.push('profile-check');
      return { isAdmin: true, challenge: 'signed-challenge' };
    },
    requestOTP: async () => {
      adminEvents.push('cognito');
      return { success: true };
    },
  });
  assert.equal(adminFlow.kind, 'admin-preview-code');
  assert.equal(adminFlow.challenge, 'signed-challenge');
  assert.deepEqual(adminEvents, [
    'account-check',
    'profile-check',
  ]);

  const registrationEvents = [];
  const registrationFlow = await beginPhoneLogin({
    mode: 'register',
    phone: '+390000000005',
    userData: {},
    checkPreviewAdmin: async () => {
      registrationEvents.push('challenge');
      return { isAdmin: false };
    },
    requestOTP: async () => {
      registrationEvents.push('cognito');
      return { success: true, phoneE164: '+390000000005', isRegister: false };
    },
    getPhoneAccountStatus: async () => {
      registrationEvents.push('account-check');
      return { exists: false };
    },
  });
  assert.equal(registrationFlow.kind, 'otp');
  assert.deepEqual(registrationEvents, ['account-check', 'cognito']);

  const loginPage = fs.readFileSync(
    require.resolve('../src/pages/LoginPage.jsx'),
    'utf8',
  );
  assert.match(loginPage, /handleRequestSmsOTP/);
  assert.match(loginPage, /sendSmsOtp/);
});

test('pre-login account status routes existing, new, and unavailable accounts safely', async () => {
  const { beginPhoneLogin } = await import('../src/lib/loginFlow.js');

  const standardEvents = [];
  const standardFlow = await beginPhoneLogin({
    mode: 'login',
    phone: '+390000000009',
    userData: {},
    getPhoneAccountStatus: async () => {
      standardEvents.push('account-check');
      return { exists: true, flow: 'cognito' };
    },
    checkPreviewAdmin: async () => {
      standardEvents.push('preview-check');
      return { isAdmin: false };
    },
    requestOTP: async () => {
      standardEvents.push('cognito');
      return { success: true, phoneE164: '+390000000009', isRegister: false };
    },
  });
  assert.equal(standardFlow.kind, 'otp');
  assert.deepEqual(standardEvents, ['account-check', 'cognito']);

  const nonPreviewAdminEvents = [];
  const nonPreviewAdminFlow = await beginPhoneLogin({
    mode: 'login',
    phone: '+390000000017',
    userData: {},
    getPhoneAccountStatus: async () => {
      nonPreviewAdminEvents.push('account-check');
      return { exists: true, flow: 'cognito' };
    },
    checkPreviewAdmin: async () => {
      nonPreviewAdminEvents.push('preview-check');
      return { isAdmin: true, challenge: 'must-not-be-used' };
    },
    requestOTP: async () => {
      nonPreviewAdminEvents.push('cognito');
      return { success: true, phoneE164: '+390000000017', isRegister: false };
    },
  });
  assert.equal(nonPreviewAdminFlow.kind, 'otp');
  assert.deepEqual(nonPreviewAdminEvents, ['account-check', 'cognito']);

  let newUserStartedCognito = false;
  const newUserFlow = await beginPhoneLogin({
    mode: 'login',
    phone: '+390000000010',
    userData: {},
    getPhoneAccountStatus: async () => ({ exists: false }),
    checkPreviewAdmin: async () => ({ isAdmin: false }),
    requestOTP: async () => {
      newUserStartedCognito = true;
      return { success: true };
    },
  });
  assert.equal(newUserFlow.kind, 'switch-to-register');
  assert.equal(newUserStartedCognito, false);

  const existingRegistrationFlow = await beginPhoneLogin({
    mode: 'register',
    phone: '+390000000011',
    userData: { firstName: 'Existing' },
    getPhoneAccountStatus: async () => ({ exists: true, flow: 'cognito' }),
    checkPreviewAdmin: async () => ({ isAdmin: false }),
    requestOTP: async () => {
      throw new Error('Cognito must not start for an existing registration');
    },
  });
  assert.equal(existingRegistrationFlow.kind, 'switch-to-login');

  let unavailableStartedCognito = false;
  const unavailableFlow = await beginPhoneLogin({
    mode: 'login',
    phone: '+390000000012',
    userData: {},
    getPhoneAccountStatus: async () => null,
    checkPreviewAdmin: async () => ({ isAdmin: false }),
    requestOTP: async () => {
      unavailableStartedCognito = true;
      return { success: true };
    },
  });
  assert.equal(unavailableFlow.kind, 'error');
  assert.equal(unavailableStartedCognito, false);
});

test('account status endpoint returns only the routing state from DynamoDB', async () => {
  const standardRoutes = loadUsersRouter({ type: 'standard', firstName: 'Standard' });
  const standardResponse = response();
  await standardRoutes.post.find(({ path }) => path === '/account-status').handler({
    body: { phone: '+39 000 000 0013' },
  }, standardResponse);
  assert.deepEqual(standardResponse.body, { exists: true, flow: 'cognito' });

  const missingRoutes = loadUsersRouter(null);
  const missingResponse = response();
  await missingRoutes.post.find(({ path }) => path === '/account-status').handler({
    body: { phone: '+39 000 000 0014' },
  }, missingResponse);
  assert.deepEqual(missingResponse.body, { exists: false });

  const adminRoutes = loadUsersRouter({ type: 'admin', firstName: 'Admin', adminPsw: true });
  const adminResponse = response();
  await adminRoutes.post.find(({ path }) => path === '/account-status').handler({
    body: { phone: '+39 000 000 0015' },
  }, adminResponse);
  assert.deepEqual(adminResponse.body, { exists: true, flow: 'preview' });

  const nonPreviewAdminRoutes = loadUsersRouter({
    type: 'admin',
    firstName: 'Admin',
    adminPsw: false,
  });
  const nonPreviewAdminResponse = response();
  await nonPreviewAdminRoutes.post.find(({ path }) => path === '/account-status').handler({
    body: { phone: '+39 000 000 0017' },
  }, nonPreviewAdminResponse);
  assert.deepEqual(nonPreviewAdminResponse.body, { exists: true, flow: 'cognito' });

  const unavailableRoutes = loadUsersRouter(new Error('DynamoDB unavailable'));
  const unavailableResponse = response();
  await unavailableRoutes.post.find(({ path }) => path === '/account-status').handler({
    body: { phone: '+39 000 000 0016' },
  }, unavailableResponse);
  assert.equal(unavailableResponse.code, 503);
  assert.deepEqual(unavailableResponse.body, { error: 'Unable to verify account' });
});

test('account status lookup is rate-limited by client instead of submitted phone', () => {
  const routes = loadUsersRouter(null);
  const route = routes.post.find(({ path }) => path === '/account-status');
  let allowed = 0;
  let blockedResponse;

  for (let attempt = 0; attempt < 21; attempt += 1) {
    const res = response();
    let nextCalled = false;
    route.handlers[0]({
      ip: '192.0.2.10',
      body: { phone: `+39000000${String(attempt).padStart(4, '0')}` },
    }, res, () => {
      nextCalled = true;
    });
    if (nextCalled) allowed += 1;
    else blockedResponse = res;
  }

  assert.equal(allowed, 20);
  assert.equal(blockedResponse.code, 429);
});

test('login routing guidance is available in Italian, English, and Bengali', async () => {
  const translations = await Promise.all([
    import('../src/i18n/it.js'),
    import('../src/i18n/en.js'),
    import('../src/i18n/bn.js'),
  ]);
  const keys = [
    'accountNotRegistered',
    'accountAlreadyRegistered',
    'loginPhoneHint',
    'invalidPhoneNumber',
    'otpResendHint',
    'accountCheckError',
  ];

  for (const { default: messages } of translations) {
    for (const key of keys) {
      assert.equal(typeof messages[key], 'string');
      assert.ok(messages[key].trim().length > 0);
    }
    assert.match(messages.loginPhoneHint, /\+393XXXXXXXXX/);
    assert.match(messages.loginPhoneHint, /\+880 1XXXXXXXXX/);
  }
});

test('preview OTP must match the same CSV row as the DynamoDB admin phone', async () => {
  const phone = '+390000000006';
  const users = [
    { adminPhoneNumber: phone, adminOTP: '123456' },
    { adminPhoneNumber: '+390000000007', adminOTP: '654321' },
  ];

  assert.ok(await findAdminByPhoneAndOTP(phone, '123456', async () => users));
  assert.equal(await findAdminByPhoneAndOTP(phone, '654321', async () => users), null);
  assert.equal(await findAdminByPhoneAndOTP(phone, '12345', async () => users), null);

  const routes = loadUsersRouter(
    { phone, type: 'admin', adminPsw: true, firstName: 'Admin' },
    {
      findCsvByPhone: (candidatePhone) => findAdminByPhone(
        candidatePhone,
        async () => users,
      ),
      findCsvByPhoneAndOTP: (candidatePhone, code) => findAdminByPhoneAndOTP(
        candidatePhone,
        code,
        async () => users,
      ),
    },
  );
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'test-preview-secret';

  try {
    const prepareResponse = response();
    await routes.post.find(({ path }) => path === '/preview-admin').handler({
      body: { phone },
    }, prepareResponse);
    assert.equal('isAdmin' in prepareResponse.body, false);

    const invalidResponse = response();
    await routes.post.find(({ path }) => path === '/preview-admin/verify').handler({
      body: {
        phone,
        code: '654321',
        challenge: prepareResponse.body.challenge,
      },
    }, invalidResponse);
    assert.equal(invalidResponse.code, 401);
    assert.deepEqual(invalidResponse.body, { isAdmin: false });

    const validResponse = response();
    await routes.post.find(({ path }) => path === '/preview-admin/verify').handler({
      body: {
        phone,
        code: '123456',
        challenge: prepareResponse.body.challenge,
      },
    }, validResponse);
    assert.equal(validResponse.code, 200);
    assert.equal(validResponse.body.isAdmin, true);
    assert.equal(validResponse.body.type, 'admin');
    assert.equal(typeof validResponse.body.token, 'string');
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

test('preview JWTs can never authorize CMS routes', () => {
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'test-shared-master-secret';
  try {
    const previewSecret = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update('preview-admin-v1')
      .digest('hex');
    const previewToken = jwt.sign(
      { kind: 'preview-session', phone: '+390000000008', type: 'admin' },
      previewSecret,
      {
        expiresIn: '8h',
        issuer: 'step2connect-preview',
        audience: 'preview-admin',
      },
    );
    const rejected = response();
    let previewAccepted = false;
    requireAdminJWT({
      headers: { authorization: `Bearer ${previewToken}` },
    }, rejected, () => {
      previewAccepted = true;
    });
    assert.equal(previewAccepted, false);
    assert.equal(rejected.code, 401);

    const cmsToken = jwt.sign(
      { kind: CMS_TOKEN_KIND, email: 'admin@example.test', name: 'Admin' },
      process.env.SESSION_SECRET,
      {
        expiresIn: '8h',
        issuer: CMS_TOKEN_ISSUER,
        audience: CMS_TOKEN_AUDIENCE,
      },
    );
    const accepted = response();
    let cmsAccepted = false;
    const request = { headers: { authorization: `Bearer ${cmsToken}` } };
    requireAdminJWT(request, accepted, () => {
      cmsAccepted = true;
    });
    assert.equal(cmsAccepted, true);
    assert.equal(request.adminUser.email, 'admin@example.test');
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});