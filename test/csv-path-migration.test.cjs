const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { Readable } = require('node:stream');

const ADMIN_KEY = 'admin-users/users.csv';
const UNUSED_ADMIN_KEY = 'admin-users/admin-users.csv';
const WHITELIST_KEY = 'whitelist-users/fincantieri-users.csv';
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

test('admin reads only the original users.csv even when another CSV exists', async () => {
  const objects = new Map([[ADMIN_KEY, ADMIN_CSV], [UNUSED_ADMIN_KEY, ADMIN_CSV.replace('Test', 'Unused')]]);
  const { store, commands } = loadAdminStore(objects);
  const result = await captureWarnings(() => store.getAdminUsers());
  assert.equal(result.value[0].name, 'Test');
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
  assert.equal(result.warnings.length, 0);
});

test('preview credentials are read from original admin CSV without warnings', async () => {
  const { store, commands } = loadAdminStore(new Map([[ADMIN_KEY, ADMIN_CSV]]));
  const result = await captureWarnings(() => store.findAdminByPhoneAndOTP('+393123456789', '001234'));
  assert.equal(result.value.adminOTP, '001234');
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
});

test('password change and reset read and write only original admin users.csv', async () => {
  for (const operation of ['password', 'reset']) {
    const objects = new Map([[ADMIN_KEY, ADMIN_CSV], [UNUSED_ADMIN_KEY, ADMIN_CSV]]);
    const { store, commands } = loadAdminStore(objects);
    const result = await captureWarnings(async () => {
      if (operation === 'password') {
        assert.equal(await store.setUserPassword('test@example.invalid', 'new-test-hash'), true);
      } else {
        assert.equal((await store.setResetToken('test@example.invalid')).length, 64);
      }
    });
    const writes = commands.filter((cmd) => cmd.constructor.name === 'PutObjectCommand');
    assert.equal(result.warnings.length, 0);
    assert.deepEqual(writes.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
    assert.equal(objects.get(UNUSED_ADMIN_KEY), ADMIN_CSV);
    const users = await store.getAdminUsers();
    assert.equal(users[0].adminOTP, '001234');
    assert.equal(users[0].adminPhoneNumber, '+393123456789');
    if (operation === 'password') assert.equal(users[0].passwordHash, 'new-test-hash');
    else assert.equal(users[0].resetToken.length, 64);
  }
});

test('admin IAM errors propagate; absent original file has no fallback or warnings', async () => {
  const denied = new Error('Denied');
  denied.name = 'AccessDenied';
  const { store, commands } = loadAdminStore(new Map([[UNUSED_ADMIN_KEY, ADMIN_CSV]]), new Map([[ADMIN_KEY, denied]]));
  const result = await captureWarnings(async () => {
    await assert.rejects(store.getAdminUsers, /Denied/);
  });
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
  const missing = loadAdminStore(new Map([[UNUSED_ADMIN_KEY, ADMIN_CSV]]));
  const absent = await captureWarnings(() => missing.store.getAdminUsers());
  assert.deepEqual(absent.value, []);
  assert.equal(absent.warnings.length, 0);
  assert.deepEqual(missing.commands.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
});

test('empty original admin file does not read other CSVs', async () => {
  const { store, commands } = loadAdminStore(new Map([[ADMIN_KEY, 'email,name,passwordHash\n'], [UNUSED_ADMIN_KEY, ADMIN_CSV]]));
  assert.deepEqual(await store.getAdminUsers(), []);
  assert.deepEqual(commands.map((cmd) => cmd.input.Key), [ADMIN_KEY]);
});

test('whitelist uses only fincantieri-users.csv, including when it is missing', async () => {
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
  assert.equal(store.WHITELIST_KEY, WHITELIST_KEY);
  assert.equal((await store.getWhitelistUsers())[0].accessCode, '001234');
  missing = true;
  assert.deepEqual(await store.getWhitelistUsers(), []);
  assert.deepEqual(keys, [WHITELIST_KEY, WHITELIST_KEY]);
});
