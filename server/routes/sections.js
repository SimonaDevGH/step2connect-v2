const express = require('express');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { getSections, setSectionStatus } = require('../lib/sections');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ sections: await getSections() });
  } catch (err) {
    console.error('[sections] read failed:', err.name);
    res.status(503).json({ error: 'Unable to load sections' });
  }
});

adminRouter.use(requireAdminJWT);
adminRouter.put('/:key', async (req, res) => {
  try {
    const sections = await setSectionStatus(req.params.key, req.body?.status, adminUserId(req));
    res.json({ sections });
  } catch (err) {
    res.status(err.status === 400 ? 400 : 500).json({
      error: err.status === 400 ? err.message : 'Unable to save section',
    });
  }
});

module.exports = { publicRouter, adminRouter };
