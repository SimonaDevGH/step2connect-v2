const { getText } = require('./s3');

const REGISTRATION_OPTIONS_KEY =
  'content/registration-login/form_registrazione_lista_aziende_cantieri.csv';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedOptions = null;
let cachedAt = 0;

/**
 * Parser CSV minimale ma compatibile con celle tra virgolette, virgole,
 * doppi apici escapati e righe con CRLF.
 */
function detectDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function uniqueValues(values) {
  return [...new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];
}

function parseRegistrationOptions(text) {
  const rows = parseCsv(String(text || ''));
  const header = (rows.shift() || []).map((value) => value.replace(/^\uFEFF/, '').trim());
  const companyIndex = header.indexOf('Azienda');
  const siteIndex = header.indexOf('Cantieri');

  if (companyIndex < 0 || siteIndex < 0) {
    throw new Error('Registration CSV must contain Azienda and Cantieri columns');
  }

  return {
    companies: uniqueValues(rows.map((row) => row[companyIndex])),
    sites: uniqueValues(rows.map((row) => row[siteIndex])),
  };
}

async function getRegistrationOptions() {
  const now = Date.now();
  if (cachedOptions && now - cachedAt < CACHE_TTL_MS) return cachedOptions;

  const csv = await getText(REGISTRATION_OPTIONS_KEY);
  const options = parseRegistrationOptions(csv);
  if (!options.companies.length || !options.sites.length) {
    throw new Error('Registration CSV contains no company or site options');
  }

  cachedOptions = options;
  cachedAt = now;
  return options;
}

module.exports = {
  REGISTRATION_OPTIONS_KEY,
  detectDelimiter,
  parseCsv,
  parseRegistrationOptions,
  getRegistrationOptions,
};