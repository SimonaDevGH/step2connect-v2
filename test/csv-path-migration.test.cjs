const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { Readable } = require('node:stream');

const NEW_ADMIN = 'admin-users/admin-users.csv';
const OLD_ADMIN = 'admin-users/users.csv';
const NEW_WHITELIST = 'whitelist-users/whitelist-users.csv';
const ADMIN_CSV = 'email,name,passwordHash,adminOTP,adminPhoneNumber,resetToken,resetExpiry\n'
  + 'test@example.invalid,Test,test-hash,001234,+393123456789,,\n';

function loadAdminStore(objects, failures = new Map()) {
  const commands = [];
  const originalLoad = Module._load;
  class GetObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  class S3Client {
    async send(command) {
      commands.push(command);
      const { Key, Body } = command.input;
      if (command instanceof PutObjectCommand) {
        objects.set(Key, Body);
        return {};
      }
      if (failures.has(Key)) throw failures.get(Key);
      if (!objects.has(Key)) {
        const err = new Error('Missing');
        err.name = 'NoSuchKey';
        throw err;
      }
      return { Body: Readable.from([Buffer.from(objects.get(Key))]) };
    }
  }
  Module._load = function(request, parent, isMain) {
    if (request === '@aws-sdk/client-s3') return { S3Client, GetObjectCommand, PutObjectCommand };
    return originalLoad.call(this, request, parent, isMain);
  };
  let store;
  try {
    delete require.cache[require.resolve('../server/lib/adminUsers')];
    store = require('../server/lib/adminUsers');
  } finally {
    Module._load = originalLoad;
  }
  return { store, commands };
}

async function captureWarnings(callback) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    return { value: await callback(), warnings };
  } finally {
    console.warn = warn;
  }
}

test('admin new CSV wins even when the legacy file exists', async () => {
  const objects = new Map([[NEW_ADMIN, ADMIN_CSV], [OLD_ADMIN, ADMIN_CSV.replace('Test', 'Legacy')]]);
  const { store, commands } = loadAdminStore(objects);
  const result = await captureWarnings(() => store.getAdminUsers());
  assert.equal(result.value[0].name, 'Test');
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [NEW_ADMIN]);
  assert.equal(result.warnings.length, 0);
});

test('missing new admin CSV reads legacy with warning and preserves preview credentials', async () => {
  const { store, commands } = loadAdminStore(new Map([[OLD_ADMIN, ADMIN_CSV]]));
  const result = await captureWarnings(() => store.findAdminByPhoneAndOTP('+393123456789', '001234'));
  assert.equal(result.value.adminOTP, '001234');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /sola lettura/);
  assert.match(result.warnings[0], /admin-users\/admin-users\.csv/);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [NEW_ADMIN, OLD_ADMIN]);
});

test('password change and reset write only the new admin name after a legacy read', async () => {
  for (const operation of ['password', 'reset']) {
    const objects = new Map([[OLD_ADMIN, ADMIN_CSV]]);
    const { store, commands } = loadAdminStore(objects);
    await captureWarnings(async () => {
      if (operation === 'password') {
        assert.equal(await store.setUserPassword('test@example.invalid', 'new-test-hash'), true);
      } else {
        assert.equal((await store.setResetToken('test@example.invalid')).length, 64);
      }
    });
    const writes = commands.filter((cmd) => cmd.constructor.name === 'PutObjectCommand');
    assert.deepEqual(writes.map((cmd) => cmd.input.Key), [NEW_ADMIN]);
    assert.equal(objects.get(OLD_ADMIN), ADMIN_CSV);
    const users = await store.getAdminUsers();
    assert.equal(users[0].adminOTP, '001234');
    assert.equal(users[0].adminPhoneNumber, '+393123456789');
    if (operation === 'password') assert.equal(users[0].passwordHash, 'new-test-hash');
    else assert.equal(users[0].resetToken.length, 64);
  }
});

test('admin IAM errors never fall back; absent files still return an empty list', async () => {
  const denied = new Error('Denied');
  denied.name = 'AccessDenied';
  const { store, commands } = loadAdminStore(new Map([[OLD_ADMIN, ADMIN_CSV]]), new Map([[NEW_ADMIN, denied]]));
  const result = await captureWarnings(async () => {
    await assert.rejects(store.getAdminUsers, /Denied/);
  });
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [NEW_ADMIN]);
  const missing = loadAdminStore(new Map());
  assert.deepEqual((await captureWarnings(() => missing.store.getAdminUsers())).value, []);
});

test('empty new admin file does not resurrect legacy accounts', async () => {
  const { store, commands } = loadAdminStore(new Map([[NEW_ADMIN, 'email,name,passwordHash\n'], [OLD_ADMIN, ADMIN_CSV]]));
  assert.deepEqual(await store.getAdminUsers(), []);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [NEW_ADMIN]);
});

test('whitelist uses only the new key, including when it is missing', async () => {
  const keys = [];
  let missing = false;
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === './s3') return {
      async getText(key) {
        keys.push(key);
        if (missing) { const err = new Error('Missing'); err.name = 'NoSuchKey'; throw err; }
        return 'phone,accessCode,firstName,lastName,company,enabled,notes\n+393123456789,001234,Test,User,ELIS,true,\n';
      },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  let store;
  try {
    delete require.cache[require.resolve('../server/lib/whitelistUsers')];
    store = require('../server/lib/whitelistUsers');
  } finally {
    Module._load = originalLoad;
  }
  assert.equal(store.WHITELIST_KEY, NEW_WHITELIST);
  assert.equal((await store.getWhitelistUsers())[0].accessCode, '001234');
  missing = true;
  assert.deepEqual(await store.getWhitelistUsers(), []);
  assert.deepEqual(keys, [NEW_WHITELIST, NEW_WHITELIST]);
});
