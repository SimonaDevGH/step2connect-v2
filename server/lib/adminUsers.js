/**
 * Gestione utenti admin CMS — CSV su S3: admin-users/users.csv
 * Formato: email,name,passwordHash,resetToken,resetExpiry
 * passwordHash = salt:hash  (scrypt, hex)
 * resetToken   = stringa hex 64 car. (opzionale, vuota se non in uso)
 * resetExpiry  = timestamp Unix in ms (opzionale, vuoto se non in uso)
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
const HEADER  = 'email,name,passwordHash,resetToken,resetExpiry\n';

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/** Retrocompatibile con CSV a 3 colonne (senza resetToken/resetExpiry). */
function parseLine(line) {
  const parts = line.split(',');
  if (parts.length < 3) return null;
  const email        = parts[0].trim().toLowerCase();
  const name         = parts[1].trim();
  const passwordHash = parts[2].trim();
  const resetToken   = (parts[3] || '').trim();
  const resetExpiry  = (parts[4] || '').trim();
  if (!email || !passwordHash) return null;
  return { email, name, passwordHash, resetToken, resetExpiry };
}

/** Legge tutti gli utenti dal CSV su S3. Restituisce [] se non esiste. */
async function getAdminUsers() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: CSV_KEY }));
    const text = await streamToString(res.Body);
    return text
      .split('\n')
      .slice(1)            // salta header
      .filter(Boolean)
      .map(parseLine)
      .filter(Boolean);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return [];
    throw err;
  }
}

/** Sovrascrive il CSV su S3 con la lista aggiornata (5 colonne). */
async function saveAdminUsers(users) {
  const body = HEADER + users
    .map((u) => [u.email, u.name, u.passwordHash, u.resetToken || '', u.resetExpiry || ''].join(','))
    .join('\n') + (users.length ? '\n' : '');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: CSV_KEY,
    Body: body,
    ContentType: 'text/csv',
  }));
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

module.exports = { getAdminUsers, saveAdminUsers, setUserPassword, setResetToken, findByResetToken };
