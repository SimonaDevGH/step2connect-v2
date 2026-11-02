const jwt = require('jsonwebtoken');
const { requireAuth } = require('./auth');
const { resolvePreviewIdentity } = require('../routes/users');
const { getUserByPhone } = require('../lib/userProfiles');

function requireNotificationUser(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Autenticazione richiesta' });
  const token = auth.slice(7);
  if (jwt.decode(token)?.iss === 'step2connect-preview') {
    resolvePreviewIdentity(token).then((identity) => {
      req.notificationUser = identity;
      next();
    }).catch(() => res.status(401).json({ error: 'Sessione non valida o scaduta' }));
    return;
  }
  return requireAuth(req, res, async () => {
    const phone = req.cognitoUser?.phone_number || req.cognitoUser?.username || '';
    if (!phone) return res.status(401).json({ error: 'Identità telefonica mancante' });
    try {
      req.notificationUser = { phone, profile: await getUserByPhone(phone) };
      next();
    } catch (err) { next(err); }
  });
}

module.exports = { requireNotificationUser };
