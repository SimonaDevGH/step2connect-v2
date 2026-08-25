const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getUserByPhone } = require('../lib/userProfiles');

const router = express.Router();

// Il numero viene esclusivamente dal JWT Cognito verificato, mai dalla richiesta.
router.get('/me', requireAuth, async (req, res) => {
  const phone = req.cognitoUser?.phone_number || req.cognitoUser?.username || '';

  try {
    const profile = await getUserByPhone(phone);
    res.json({
      firstName: typeof profile?.firstName === 'string' ? profile.firstName : '',
    });
  } catch (err) {
    console.error('[users] profile lookup error:', err);
    res.status(500).json({ error: 'Unable to load user profile' });
  }
});

module.exports = router;