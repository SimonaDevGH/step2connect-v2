/**
 * Middleware di autenticazione per l'area CMS admin.
 * Verifica un JWT firmato con SESSION_SECRET (separato da Cognito).
 */
const jwt = require('jsonwebtoken');
const CMS_TOKEN_KIND = 'cms-admin';
const CMS_TOKEN_ISSUER = 'step2connect-cms';
const CMS_TOKEN_AUDIENCE = 'cms-admin';

function requireAdminJWT(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = auth.slice(7);
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'SESSION_SECRET non configurato' });
  }
  try {
    const payload = jwt.verify(token, secret, {
      issuer: CMS_TOKEN_ISSUER,
      audience: CMS_TOKEN_AUDIENCE,
    });
    if (payload.kind !== CMS_TOKEN_KIND || typeof payload.email !== 'string' || !payload.email) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }
    req.adminUser = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto', detail: err.message });
  }
}

function adminUserId(req) {
  return req.adminUser?.email || 'unknown';
}

module.exports = {
  requireAdminJWT,
  adminUserId,
  CMS_TOKEN_KIND,
  CMS_TOKEN_ISSUER,
  CMS_TOKEN_AUDIENCE,
};
