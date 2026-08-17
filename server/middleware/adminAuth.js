/**
 * Middleware di autenticazione per l'area CMS admin.
 * Verifica un JWT firmato con SESSION_SECRET (separato da Cognito).
 */
const jwt = require('jsonwebtoken');

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
    const payload = jwt.verify(token, secret);
    req.adminUser = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto', detail: err.message });
  }
}

function adminUserId(req) {
  return req.adminUser?.email || 'unknown';
}

module.exports = { requireAdminJWT, adminUserId };
