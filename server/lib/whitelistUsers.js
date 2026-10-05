const crypto = require('crypto');
const { getText } = require('./s3');
const { parseCsv } = require('./registrationOptions');
const { normalizePhone } = require('./adminUsers');

const WHITELIST_KEY = 'whitelist-users/fincantieri-users.csv';
const FIELDS = ['phone', 'accessCode', 'firstName', 'lastName', 'company', 'enabled', 'notes'];

function parseWhitelistUsers(text) {
  const rows = parseCsv(String(text || ''));
  const header = (rows.shift() || []).map((value) => value.replace(/^\uFEFF/, '').trim());
  if (FIELDS.some((field) => !header.includes(field))) {
    throw new Error('Whitelist CSV is missing required columns');
  }
  const users = rows.filter((row) => row.some((cell) => cell.trim())).map((row) =>
    Object.fromEntries(FIELDS.map((field) => [field, (row[header.indexOf(field)] || '').trim()]))
  );
  const seen = new Set();
  for (const user of users) {
    user.phone = normalizePhone(user.phone);
    if (!user.phone || seen.has(user.phone)) {
      throw new Error('Whitelist CSV contains invalid or duplicate phones');
    }
    seen.add(user.phone);
  }
  return users;
}

// Nessuna cache: revoche e cambi di codice sono riletti a ogni lookup.
async function getWhitelistUsers() {
  try {
    return parseWhitelistUsers(await getText(WHITELIST_KEY));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return [];
    throw err;
  }
}

async function findWhitelistByPhone(phone, usersLoader = getWhitelistUsers) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const users = await usersLoader();
  return users.find((user) =>
    user.phone === normalized && user.enabled === 'true' && /^\d{6}$/.test(user.accessCode)
  ) || null;
}

function matchesAccessCode(user, code) {
  if (!user || typeof code !== 'string' || !/^\d{6}$/.test(code)
    || !/^\d{6}$/.test(user.accessCode)) return false;
  return crypto.timingSafeEqual(Buffer.from(user.accessCode), Buffer.from(code));
}

module.exports = {
  WHITELIST_KEY, parseWhitelistUsers, getWhitelistUsers, findWhitelistByPhone, matchesAccessCode,
};
