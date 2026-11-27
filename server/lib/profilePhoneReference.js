const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function signingKey() {
  if (!process.env.SESSION_SECRET) {
    throw Object.assign(new Error('Profile change unavailable'), { status: 503 });
  }
  return crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update('profile-phone-reference-v1').digest('hex');
}

function createProfilePhoneReference({ sub, profileId, oldPhone, newPhone }) {
  return jwt.sign({ kind: 'profile-phone-change', profileId, oldPhone, newPhone }, signingKey(), {
    algorithm: 'HS256', issuer: 'step2connect-profile', audience: 'phone-change',
    subject: sub, expiresIn: '24h',
  });
}

function readProfilePhoneReference(reference, sub, newPhone) {
  try {
    const payload = jwt.verify(reference, signingKey(), {
      algorithms: ['HS256'], issuer: 'step2connect-profile', audience: 'phone-change', subject: sub,
    });
    if (payload.kind !== 'profile-phone-change' || payload.newPhone !== newPhone
      || typeof payload.profileId !== 'string' || !payload.profileId || !payload.oldPhone) throw new Error();
    return payload;
  } catch {
    throw Object.assign(new Error('Invalid profile reference'), { status: 403 });
  }
}

module.exports = { createProfilePhoneReference, readProfilePhoneReference };
