const assert = require('node:assert/strict');
const test = require('node:test');

test('phone validation accepts the supported Italian and Bangladeshi formats', async () => {
  const { validatePhoneNumber } = await import('../src/lib/phoneValidation.js');

  assert.deepEqual(validatePhoneNumber('+393123456789'), { valid: true, country: 'it' });
  assert.deepEqual(validatePhoneNumber('+39 3123456789'), { valid: true, country: 'it' });
  assert.deepEqual(validatePhoneNumber('+880 1712345678'), { valid: true, country: 'bd' });
  assert.deepEqual(validatePhoneNumber('+8801712345678'), { valid: true, country: 'bd' });
});

test('phone validation rejects missing plus, wrong lengths, and unsupported prefixes', async () => {
  const { validatePhoneNumber } = await import('../src/lib/phoneValidation.js');

  for (const phone of [
    '393123456789',
    '+39312345678',
    '+3931234567890',
    '+880 171234567',
    '+880 2712345678',
    '+1 2025550123',
  ]) {
    assert.deepEqual(validatePhoneNumber(phone), { valid: false }, phone);
  }
});