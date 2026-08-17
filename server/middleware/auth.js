const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const REGION    = process.env.COGNITO_REGION    || process.env.AWS_REGION || 'eu-west-2';
const POOL_ID   = process.env.COGNITO_USER_POOL_ID || process.env.VITE_COGNITO_USER_POOL_ID;
const JWKS_URI  = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`;
const ISSUER    = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;

const client = jwksClient({ jwksUri: JWKS_URI, cache: true, rateLimit: true });

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/** Verifica il token JWT Cognito. Popola req.cognitoUser con il payload. */
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = auth.slice(7);
  jwt.verify(token, getKey, { issuer: ISSUER, algorithms: ['RS256'] }, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token', detail: err.message });
    }
    req.cognitoUser = payload;
    next();
  });
}

/** Controlla che l'utente sia nel gruppo Cognito "content-admin". */
function requireAdminGroup(req, res, next) {
  const groups = req.cognitoUser?.['cognito:groups'] || [];
  if (!groups.includes('content-admin')) {
    return res.status(403).json({ error: 'Forbidden: content-admin group required' });
  }
  next();
}

/** Identità dell'utente corrente (sub o phone_number). */
function userId(req) {
  return req.cognitoUser?.sub || req.cognitoUser?.phone_number || 'unknown';
}

module.exports = { requireAuth, requireAdminGroup, userId };
