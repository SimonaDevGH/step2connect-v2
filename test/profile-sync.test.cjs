const assert = require('node:assert/strict');
const test = require('node:test');

test('normal login cannot clear profile fields already stored in DynamoDB', async () => {
  const { buildProfileSyncPayload } = await import('../src/lib/profileSync.js');

  const normalLoginPayload = buildProfileSyncPayload({
    phone: '+390000000001',
    firstName: '',
    lastName: '   ',
    email: undefined,
    company: null,
    site: '',
  });

  assert.equal(normalLoginPayload, null);
});

test('profile sync sends only non-empty values', async () => {
  const { buildProfileSyncPayload } = await import('../src/lib/profileSync.js');

  const registrationPayload = buildProfileSyncPayload({
    phone: '+390000000001',
    firstName: 'Mario',
    lastName: '',
    email: 'mario@example.test',
    company: 'Fincantieri S.p.A.',
    site: '   ',
  });

  assert.deepEqual(registrationPayload, {
    phone: '+390000000001',
    firstName: 'Mario',
    email: 'mario@example.test',
    company: 'Fincantieri S.p.A.',
  });
});