/**
 * Route di autenticazione CMS admin (email + password).
 * POST /api/admin/auth/login           → JWT 8h
 * GET  /api/admin/auth/me              → dati utente loggato
 * POST /api/admin/auth/change-password → cambia password (richiede JWT)
 * POST /api/admin/auth/forgot-password → invia email di reset (sempre 200)
 * POST /api/admin/auth/reset-password  → imposta nuova password via token
 */
const express = require('express');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { getAdminUsers, setUserPassword, setResetToken, findByResetToken } = require('../lib/adminUsers');
const { requireAdminJWT } = require('../middleware/adminAuth');
const { sendEmail } = require('../lib/sendEmail');

const router = express.Router();

// ── Helper: hash password ──────────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
}

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password obbligatori' });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'SESSION_SECRET non configurato sul server' });
  }

  try {
    const users = await getAdminUsers();
    const user  = users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = jwt.sign(
      { email: user.email, name: user.name },
      secret,
      { expiresIn: '8h' }
    );
    res.json({ token, email: user.email, name: user.name });
  } catch (err) {
    console.error('[adminAuth] login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get('/me', requireAdminJWT, (req, res) => {
  res.json({ email: req.adminUser.email, name: req.adminUser.name });
});

// ── POST /change-password ─────────────────────────────────────────────────────
router.post('/change-password', requireAdminJWT, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword e newPassword obbligatori' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nuova password deve contenere almeno 8 caratteri' });
  }

  try {
    const users = await getAdminUsers();
    const user  = users.find((u) => u.email === req.adminUser.email);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    await setUserPassword(req.adminUser.email, hashPassword(newPassword));
    res.json({ ok: true });
  } catch (err) {
    console.error('[adminAuth] change-password error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
// Risponde sempre 200 per non rivelare se l'email è registrata.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email obbligatoria' });

  // Risposta immediata al client; operazione asincrona in background
  res.json({ ok: true });

  try {
    const token = await setResetToken(email.trim().toLowerCase());
    if (!token) return; // utente non trovato — non fare nulla

    // Costruiamo la base URL dall'origin del request (funziona in dev e prod)
    const origin = req.headers.origin ||
      `${req.protocol}://${req.get('host')}`;
    const resetLink = `${origin}/admin/reset-password?token=${token}`;

    await sendEmail({
      to: email.trim(),
      subject: 'Step2Connect Admin — Reset password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
          <h2 style="color:#1D3557;margin:0 0 16px">Reset della tua password Admin</h2>
          <p style="color:#444;line-height:1.6">
            Hai richiesto il reset della password per il pannello CMS di Step2Connect.<br>
            Clicca il pulsante qui sotto per impostare una nuova password.
            Il link è valido per <strong>1 ora</strong>.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${resetLink}"
               style="background:#1D3557;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
              Reimposta password
            </a>
          </div>
          <p style="color:#888;font-size:12px">
            Se non hai richiesto il reset, ignora questa email — la tua password rimane invariata.<br>
            Oppure copia questo link nel browser:<br>
            <a href="${resetLink}" style="color:#1D3557;word-break:break-all">${resetLink}</a>
          </p>
        </div>
      `,
      text: `Reset password Step2Connect Admin\n\nClicca questo link per impostare una nuova password (valido 1 ora):\n${resetLink}\n\nSe non hai richiesto il reset, ignora questa email.`,
    });
    console.log(`[adminAuth] reset email inviata a ${email}`);
  } catch (err) {
    console.error('[adminAuth] forgot-password error', err);
  }
});

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token e newPassword obbligatori' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La password deve contenere almeno 8 caratteri' });
  }

  try {
    const user = await findByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Link non valido o scaduto. Richiedi un nuovo reset.' });
    }

    await setUserPassword(user.email, hashPassword(newPassword));
    res.json({ ok: true });
  } catch (err) {
    console.error('[adminAuth] reset-password error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
