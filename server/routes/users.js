const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const {
  getUserByPhone,
  isAdminProfile,
  isPreviewAdminProfile,
} = require('../lib/userProfiles');
const {
  findAdminByPhone,
  findAdminByPhoneAndOTP,
} = require('../lib/adminUsers');

const router = express.Router();
const PREVIEW_CHALLENGE_TTL = '5m';
const PREVIEW_SESSION_TTL = '8h';
const PREVIEW_RATE_WINDOW_MS = 60_000;
const PREVIEW_RATE_MAX = 10;
const ACCOUNT_STATUS_RATE_MAX = 20;
const PREVIEW_TOKEN_ISSUER = 'step2connect-preview';
const PREVIEW_TOKEN_AUDIENCE = 'preview-admin';
const previewAttempts = new Map();
const accountStatusAttempts = new Map();

function previewClientKey(req) {
  const connection = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${connection}:${normalizePhone(req.body?.phone) || 'invalid'}`;
}

function limitPreviewAttempts(req, res, next) {
  const now = Date.now();
  const key = previewClientKey(req);
  const current = previewAttempts.get(key);
  const entry = !current || now - current.startedAt >= PREVIEW_RATE_WINDOW_MS
    ? { startedAt: now, count: 0 }
    : current;
  entry.count += 1;
  previewAttempts.set(key, entry);

  if (previewAttempts.size > 1000) {
    for (const [candidate, attempt] of previewAttempts) {
      if (now - attempt.startedAt >= PREVIEW_RATE_WINDOW_MS) {
        previewAttempts.delete(candidate);
      }
    }
  }

  if (entry.count > PREVIEW_RATE_MAX) {
    return res.status(429).json({ isAdmin: false });
  }
  next();
}

function limitAccountStatusAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const current = accountStatusAttempts.get(key);
  const entry = !current || now - current.startedAt >= PREVIEW_RATE_WINDOW_MS
    ? { startedAt: now, count: 0 }
    : current;
  entry.count += 1;
  accountStatusAttempts.set(key, entry);

  if (accountStatusAttempts.size > 1000) {
    for (const [candidate, attempt] of accountStatusAttempts) {
      if (now - attempt.startedAt >= PREVIEW_RATE_WINDOW_MS) {
        accountStatusAttempts.delete(candidate);
      }
    }
  }

  if (entry.count > ACCOUNT_STATUS_RATE_MAX) {
    return res.status(429).json({ error: 'Too many attempts' });
  }
  next();
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

function getPreviewSecret() {
  const masterSecret = process.env.SESSION_SECRET;
  if (!masterSecret) return '';
  return crypto
    .createHmac('sha256', masterSecret)
    .update('preview-admin-v1')
    .digest('hex');
}

function previewCredentialVersion(secret, phone, adminOTP) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${phone}:${adminOTP}`)
    .digest('hex');
}

function secureStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Restituisce solo lo stato minimo necessario al routing pre-login.
// La distinzione esistenza/flusso è richiesta dalla UX ed è limitata per IP.
router.post('/account-status', limitAccountStatusAttempts, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Invalid phone' });

  try {
    const profile = await getUserByPhone(phone);
    if (!profile) return res.json({ exists: false });

    res.json({
      exists: true,
      flow: isPreviewAdminProfile(profile) ? 'preview' : 'cognito',
    });
  } catch (err) {
    console.error('[users] account status lookup error:', err);
    res.status(503).json({ error: 'Unable to verify account' });
  }
});

// Prepara una challenge indistinguibile per ogni numero valido.
// L'idoneità admin viene verificata esclusivamente dopo l'invio del codice.
router.post('/preview-admin', limitPreviewAttempts, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Invalid phone' });

  try {
    const secret = getPreviewSecret();
    if (!secret) {
      console.error('[users] preview admin session secret is not configured');
      return res.status(500).json({ error: 'Unable to prepare login' });
    }

    const challenge = jwt.sign(
      { kind: 'preview-challenge', phone },
      secret,
      {
        expiresIn: PREVIEW_CHALLENGE_TTL,
        issuer: PREVIEW_TOKEN_ISSUER,
        audience: PREVIEW_TOKEN_AUDIENCE,
      },
    );
    res.json({ challenge });
  } catch (err) {
    console.error('[users] login challenge error:', err);
    res.status(500).json({ error: 'Unable to prepare login' });
  }
});

// Verifica il codice preview sul server e rilascia una sessione firmata.
// Il numero da solo non è mai sufficiente per creare una sessione admin.
router.post('/preview-admin/verify', limitPreviewAttempts, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
  const secret = getPreviewSecret();

    if (!phone || !code || !challenge || !secret) {
    return res.status(401).json({ isAdmin: false });
  }

  try {
    const challengePayload = jwt.verify(challenge, secret, {
      issuer: PREVIEW_TOKEN_ISSUER,
      audience: PREVIEW_TOKEN_AUDIENCE,
    });
    if (challengePayload.kind !== 'preview-challenge' || challengePayload.phone !== phone) {
      return res.status(401).json({ isAdmin: false });
    }
    const [profile, csvAdmin] = await Promise.all([
      getUserByPhone(phone),
      findAdminByPhoneAndOTP(phone, code),
    ]);
    if (!isPreviewAdminProfile(profile) || !csvAdmin) {
      return res.status(401).json({ isAdmin: false });
    }

    const token = jwt.sign(
      {
        kind: 'preview-session',
        phone,
        type: 'admin',
        credentialVersion: previewCredentialVersion(secret, phone, csvAdmin.adminOTP),
      },
      secret,
      {
        expiresIn: PREVIEW_SESSION_TTL,
        issuer: PREVIEW_TOKEN_ISSUER,
        audience: PREVIEW_TOKEN_AUDIENCE,
      },
    );
    res.json({
      isAdmin: true,
      token,
      firstName: typeof profile.firstName === 'string' ? profile.firstName : '',
      type: 'admin',
    });
  } catch (err) {
    res.status(401).json({ isAdmin: false });
  }
});

// Ripristina una sessione preview già verificata e ricontrolla il profilo.
router.get('/preview-admin/session', async (req, res) => {
  const auth = req.headers.authorization || '';
  const secret = getPreviewSecret();
  if (!secret || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ isAdmin: false });
  }

  try {
    const payload = jwt.verify(auth.slice(7), secret, {
      issuer: PREVIEW_TOKEN_ISSUER,
      audience: PREVIEW_TOKEN_AUDIENCE,
    });
    if (payload.kind !== 'preview-session' || !payload.phone) {
      return res.status(401).json({ isAdmin: false });
    }
    const profile = await getUserByPhone(payload.phone);
    if (!isPreviewAdminProfile(profile)) {
      return res.status(401).json({ isAdmin: false });
    }
    const csvAdmin = await findAdminByPhone(payload.phone);
    const currentCredentialVersion = csvAdmin
      ? previewCredentialVersion(secret, payload.phone, csvAdmin.adminOTP)
      : '';
    if (!secureStringEqual(payload.credentialVersion, currentCredentialVersion)) {
      return res.status(401).json({ isAdmin: false });
    }
    res.json({
      isAdmin: true,
      firstName: typeof profile.firstName === 'string' ? profile.firstName : '',
      type: 'admin',
    });
  } catch (err) {
    res.status(401).json({ isAdmin: false });
  }
});

// Il numero viene esclusivamente dal JWT Cognito verificato, mai dalla richiesta.
router.get('/me', requireAuth, async (req, res) => {
  const phone = req.cognitoUser?.phone_number || req.cognitoUser?.username || '';

  try {
    const profile = await getUserByPhone(phone);
    res.json({
      firstName: typeof profile?.firstName === 'string' ? profile.firstName : '',
      type: isAdminProfile(profile) ? 'admin' : 'standard',
    });
  } catch (err) {
    console.error('[users] profile lookup error:', err);
    res.status(500).json({ error: 'Unable to load user profile' });
  }
});

module.exports = router;