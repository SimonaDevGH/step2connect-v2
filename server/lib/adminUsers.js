/**
 * Gestione utenti admin CMS — CSV su S3: admin-users/users.csv
 * Formato: email,name,passwordHash,adminOTP,adminPhoneNumber,resetToken,resetExpiry
 * passwordHash = salt:hash  (scrypt, hex)
 * resetToken   = stringa hex 64 car. (opzionale, vuota se non in uso)
 * resetExpiry  = timestamp Unix in ms (opzionale, vuoto se non in uso)
 * adminOTP     = codice preview di 6 cifre (opzionale)
 * adminPhoneNumber = numero E.164 autorizzato alla preview (opzionale)
 */
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const crypto = require('crypto');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET  = process.env.S3_BUCKET_NAME;
const CSV_KEY = 'admin-users/users.csv';
const CSV_FIELDS = [
  'email',
  'name',
  'passwordHash',
  'adminOTP',
  'adminPhoneNumber',
  'resetToken',
  'resetExpiry',
];
const HEADER = `${CSV_FIELDS.join(',')}\n`;

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/** Retrocompatibile con qualunque ordine dichiarato nell'header. */
function parseLine(line, headerFields) {
  const parts = line.split(',');
  const value = (field) => {
    const index = headerFields.indexOf(field);
    return index >= 0 ? (parts[index] || '').trim() : '';
  };
  const email = value('email').toLowerCase();
  const name = value('name');
  const passwordHash = value('passwordHash');
  const adminOTP = value('adminOTP');
  const adminPhoneNumber = value('adminPhoneNumber');
  const resetToken = value('resetToken');
  const resetExpiry = value('resetExpiry');
  if (!email || !passwordHash) return null;
  return {
    email,
    name,
    passwordHash,
    resetToken,
    resetExpiry,
    adminOTP,
    adminPhoneNumber,
  };
}

/** Legge tutti gli utenti dal CSV su S3. Restituisce [] se non esiste. */
async function getAdminUsers() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: CSV_KEY }));
    const text = await streamToString(res.Body);
    const lines = text.split(/\r?\n/);
    const headerFields = (lines.shift() || '')
      .replace(/^\uFEFF/, '')
      .split(',')
      .map((field) => field.trim());
    return lines
      .filter(Boolean)
      .map((line) => parseLine(line, headerFields))
      .filter(Boolean);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return [];
    throw err;
  }
}

/** Sovrascrive il CSV su S3 con la lista aggiornata. */
async function saveAdminUsers(users) {
  const body = HEADER + users
    .map((u) => [
      u.email,
      u.name,
      u.passwordHash,
      u.adminOTP || '',
      u.adminPhoneNumber || '',
      u.resetToken || '',
      u.resetExpiry || '',
    ].join(','))
    .join('\n') + (users.length ? '\n' : '');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: CSV_KEY,
    Body: body,
    ContentType: 'text/csv',
  }));
}

function normalizePhone(rawPhone) {
  if (typeof rawPhone !== 'string') return '';
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('39') && digits.length >= 11) return `+${digits}`;
  return `+39${digits}`;
}

function secureStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Cerca la seconda credenziale preview. Il numero e il codice devono
 * appartenere alla stessa riga del CSV.
 */
async function findAdminByPhoneAndOTP(phone, adminOTP, usersLoader = getAdminUsers) {
  const user = await findAdminByPhone(phone, usersLoader);
  if (!user || !/^\d{6}$/.test(String(adminOTP || ''))) return null;
  return secureStringEqual(user.adminOTP, String(adminOTP)) ? user : null;
}

async function findAdminByPhone(phone, usersLoader = getAdminUsers) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  const users = await usersLoader();
  return users.find((user) =>
    normalizePhone(user.adminPhoneNumber) === normalizedPhone
    && /^\d{6}$/.test(user.adminOTP || '')
  ) || null;
}

/** Aggiorna la password di un utente. Restituisce false se l'utente non esiste. */
async function setUserPassword(email, newPasswordHash) {
  const users = await getAdminUsers();
  const idx = users.findIndex((u) => u.email === email.toLowerCase());
  if (idx < 0) return false;
  users[idx] = { ...users[idx], passwordHash: newPasswordHash, resetToken: '', resetExpiry: '' };
  await saveAdminUsers(users);
  return true;
}

/** Genera e salva un token di reset (valido 1 ora). Restituisce il token. */
async function setResetToken(email) {
  const users = await getAdminUsers();
  const idx = users.findIndex((u) => u.email === email.toLowerCase());
  if (idx < 0) return null;
  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = String(Date.now() + 60 * 60 * 1000); // +1 ora
  users[idx] = { ...users[idx], resetToken: token, resetExpiry: expiry };
  await saveAdminUsers(users);
  return token;
}

/** Trova un utente tramite il token di reset (controlla anche la scadenza). */
async function findByResetToken(token) {
  if (!token) return null;
  const users = await getAdminUsers();
  const user = users.find((u) => u.resetToken === token);
  if (!user) return null;
  if (!user.resetExpiry || Date.now() > Number(user.resetExpiry)) return null; // scaduto
  return user;
}

module.exports = {
  getAdminUsers,
  saveAdminUsers,
  setUserPassword,
  setResetToken,
  findByResetToken,
  findAdminByPhone,
  findAdminByPhoneAndOTP,
  normalizePhone,
};
