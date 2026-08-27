/**
 * Gestione utenti admin CMS — legge/scrive admin-users/users.csv su S3.
 *
 * Comandi:
 *   node scripts/manage-admin-users.mjs list
 *   node scripts/manage-admin-users.mjs add <email> <nome> <password>
 *   node scripts/manage-admin-users.mjs remove <email>
 *
 * Richiede le variabili d'ambiente:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
 */
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
require('dotenv').config();
const {
  getAdminUsers: readCSV,
  saveAdminUsers: writeCSV,
} = require('../server/lib/adminUsers');

const BUCKET  = process.env.S3_BUCKET_NAME;

// ── Hash password ─────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// ── Comandi ───────────────────────────────────────────────────────────────────

async function cmdList() {
  const users = await readCSV();
  if (users.length === 0) {
    console.log('Nessun utente admin registrato.');
    return;
  }
  console.log(`\n${'EMAIL'.padEnd(40)} NOME`);
  console.log('─'.repeat(60));
  users.forEach((u) => console.log(`${u.email.padEnd(40)} ${u.name}`));
  console.log(`\nTotale: ${users.length} utente/i\n`);
}

async function cmdAdd(email, name, password) {
  if (!email || !name || !password) {
    console.error('Uso: node scripts/manage-admin-users.mjs add <email> <nome> <password>');
    process.exit(1);
  }
  const users = await readCSV();
  const norm  = email.trim().toLowerCase();
  if (users.find((u) => u.email === norm)) {
    console.error(`Errore: l'utente ${norm} esiste già. Usa 'remove' prima di ri-aggiungerlo.`);
    process.exit(1);
  }
  const passwordHash = hashPassword(password);
  users.push({
    email: norm,
    name: name.trim(),
    passwordHash,
    adminOTP: '',
    adminPhoneNumber: '',
    resetToken: '',
    resetExpiry: '',
  });
  await writeCSV(users);
  console.log(`✅ Utente aggiunto: ${norm} (${name})`);
}

async function cmdRemove(email) {
  if (!email) {
    console.error('Uso: node scripts/manage-admin-users.mjs remove <email>');
    process.exit(1);
  }
  const norm     = email.trim().toLowerCase();
  const users    = await readCSV();
  const filtered = users.filter((u) => u.email !== norm);
  if (filtered.length === users.length) {
    console.error(`Utente non trovato: ${norm}`);
    process.exit(1);
  }
  await writeCSV(filtered);
  console.log(`✅ Utente rimosso: ${norm}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

if (!BUCKET) {
  console.error('Errore: S3_BUCKET_NAME non impostato.');
  process.exit(1);
}

switch (cmd) {
  case 'list':
    await cmdList();
    break;
  case 'add':
    await cmdAdd(args[0], args[1], args[2]);
    break;
  case 'remove':
    await cmdRemove(args[0]);
    break;
  default:
    console.log(`
Uso:
  node scripts/manage-admin-users.mjs list
  node scripts/manage-admin-users.mjs add <email> <nome> <password>
  node scripts/manage-admin-users.mjs remove <email>
    `);
    process.exit(1);
}
