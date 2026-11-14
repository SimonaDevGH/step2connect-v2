import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import legacy from '../server/lib/legacyUsers.js';
import s3 from '../server/lib/s3.js';

export function prepareLegacyUsers(text, appUrl, generate = () => randomBytes(32).toString('base64url')) {
  const base = new URL(appUrl);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password
    || base.search || base.hash || base.pathname !== '/') throw new Error('Invalid PUBLIC_APP_URL');
  const { header, rows } = legacy.parseLegacyCsv(text, false);
  const emailIndex = header.indexOf('user_email');
  const normalized = rows.map(row => row[emailIndex].replace(/\s/g, '').toLowerCase());
  const counts = new Map();
  normalized.forEach(email => counts.set(email, (counts.get(email) || 0) + 1));
  const report = { totalRows: rows.length, rowsWithLink: 0, skippedRows: 0,
    skipped: { missingOrInvalidEmail: [], duplicateEmail: [] }, accountStatus: {}, ruolo: {} };
  const output = rows.map((row, i) => {
    for (const [field, target] of [['account_status', report.accountStatus], ['ruolo', report.ruolo]]) {
      const value = row[header.indexOf(field)];
      Object.defineProperty(target, value, { value: (Object.hasOwn(target, value) ? target[value] : 0) + 1,
        enumerable: true, configurable: true, writable: true });
    }
    // Keep original values exactly; normalization is used solely for validation/deduplication.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[emailIndex].trim())) {
      report.skippedRows++;
      report.skipped.missingOrInvalidEmail.push(row[0]);
      return [...row, '', '', ''];
    }
    if (counts.get(normalized[i]) > 1) {
      report.skippedRows++;
      report.skipped.duplicateEmail.push(row[0]);
      return [...row, '', '', ''];
    }
    report.rowsWithLink++;
    return [...row, `${base.origin}/bentornato?t=${generate()}`, 'active', 'not_migrated'];
  });
  return { csv: legacy.serializeCsv([[...header, ...legacy.EXTRA_FIELDS], ...output]), report };
}

export async function run(args = process.argv.slice(2), {
  env = process.env, read = readFile, write = s3.putTextConditional, forceWrite = s3.putBuffer,
  print = console.log,
} = {}) {
  const flags = new Set(args.filter(arg => arg.startsWith('--')));
  const files = args.filter(arg => !arg.startsWith('--'));
  if (files.length !== 1 || [...flags].some(flag => !['--dry-run', '--force'].includes(flag))) {
    throw new Error('Usage: node scripts/prepare-legacy-users.mjs <export.csv> [--dry-run] [--force]');
  }
  if (!env.PUBLIC_APP_URL) throw new Error('PUBLIC_APP_URL is required');
  const result = prepareLegacyUsers(await read(files[0], 'utf8'), env.PUBLIC_APP_URL);
  print(JSON.stringify(result.report, null, 2)); // Counts and requested row IDs only, never links/emails.
  if (flags.has('--dry-run')) return result.report;
  if (flags.has('--force')) {
    await forceWrite(legacy.LEGACY_KEY, Buffer.from(result.csv), 'text/csv; charset=utf-8');
  } else {
    // Atomic existence check; no ListBucket permission is needed for a missing object.
    try {
      await write(legacy.LEGACY_KEY, result.csv, { ifNoneMatch: '*' });
    } catch (error) {
      if (error.name === 'PreconditionFailed' || error.$metadata?.httpStatusCode === 412) {
        throw new Error('Legacy file already exists; refusing to replace it without --force');
      }
      throw error;
    }
  }
  return result.report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    // Never echo paths, CSV contents, AWS responses or generated tokens.
    const safe = /^(PUBLIC_APP_URL is required|Invalid PUBLIC_APP_URL|Invalid legacy CSV|Usage:|Legacy file already exists)/;
    console.error(safe.test(error.message) ? error.message : 'Legacy preparation failed; check input, configuration and S3 permissions');
    process.exitCode = 1;
  });
}
