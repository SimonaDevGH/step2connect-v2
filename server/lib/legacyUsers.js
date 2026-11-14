const crypto = require('crypto');
const { parseCsv } = require('./registrationOptions');
const { getTextWithETag, putTextConditional } = require('./s3');

const LEGACY_KEY = 'user_legacy_s2c_v1/user_legacy_s2c_v1.csv';
const ORIGINAL_FIELDS = 'id,user_login,user_email,user_registered,display_name,first_name,last_name,full_name,nickname,aziendadiappartenenza,cantierediappartenenza,use_gdpr_agreement,account_status,ruolo,form_id'.split(',');
const EXTRA_FIELDS = ['link_univoco', 'link_univoco_status', 'migration_status'];
const FIELDS = [...ORIGINAL_FIELDS, ...EXTRA_FIELDS];

function serializeCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n') + '\r\n';
}

function parseLegacyCsv(text, prepared = true) {
  const rows = parseCsv(String(text).replace(/^\uFEFF/, ''), ',');
  const header = rows.shift() || [];
  const expected = prepared ? FIELDS : ORIGINAL_FIELDS;
  if (header.length !== expected.length || expected.some((field, i) => field !== header[i])) {
    throw new Error('Invalid legacy CSV columns or order');
  }
  const ids = new Set();
  for (const row of rows) {
    if (row.length !== header.length || !row[0] || ids.has(row[0])) {
      throw new Error('Invalid legacy CSV row or duplicate id');
    }
    ids.add(row[0]);
  }
  return { header, rows };
}

function isUsable(record) {
  return record?.link_univoco_status === 'active' && record?.migration_status === 'not_migrated';
}

function recordFromRow(header, row) {
  return Object.fromEntries(header.map((key, index) => [key, row[index]]));
}

function validToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

async function findByToken(token, read = getTextWithETag) {
  if (!validToken(token)) return null;
  let file;
  try { file = await read(LEGACY_KEY); } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
  const { header, rows } = parseLegacyCsv(file.text);
  const matches = [];
  for (const row of rows) {
    const record = recordFromRow(header, row);
    let stored;
    try { stored = new URL(record.link_univoco).searchParams.get('t'); } catch { continue; }
    if (validToken(stored) && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored))) {
      matches.push(record);
    }
  }
  return matches.length === 1 && isUsable(matches[0]) ? matches[0] : null;
}

async function markMigrated(id, { read = getTextWithETag, write = putTextConditional } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { text, etag } = await read(LEGACY_KEY);
    const { header, rows } = parseLegacyCsv(text);
    const row = rows.find(candidate => candidate[0] === id);
    if (!row || !isUsable(recordFromRow(header, row))) return false;
    row[header.indexOf('link_univoco_status')] = 'used';
    row[header.indexOf('migration_status')] = 'migrated';
    try {
      await write(LEGACY_KEY, serializeCsv([header, ...rows]), { ifMatch: etag });
      return true;
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 412 && error.name !== 'PreconditionFailed') throw error;
      if (attempt === 4) throw new Error('Legacy update conflict');
    }
  }
}

function publicProfile(record) {
  let firstName = record.first_name;
  let lastName = record.last_name;
  if (!firstName.trim() && !lastName.trim()) {
    const words = record.display_name.trim().split(/\s+/);
    firstName = words.shift() || '';
    lastName = words.join(' ');
  }
  return { firstName, lastName, email: record.user_email,
    company: record.aziendadiappartenenza, site: record.cantierediappartenenza };
}

module.exports = {
  LEGACY_KEY, ORIGINAL_FIELDS, EXTRA_FIELDS, FIELDS, serializeCsv, parseLegacyCsv,
  isUsable, validToken, findByToken, markMigrated, publicProfile,
};
