const express = require('express');
const { getRegistrationOptions } = require('../lib/registrationOptions');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await getRegistrationOptions());
  } catch (err) {
    console.error('[registration-options] CSV load error:', err);
    res.status(503).json({ error: 'Registration options unavailable' });
  }
});

module.exports = router;