/**
 * Route pubbliche — lettura dei contenuti PUBBLICATI.
 * Non richiedono autenticazione.
 * Leggono solo da content/published/, mai da draft/ o archive/.
 */
const express = require('express');
const { getJson, listKeys } = require('../lib/s3');
const router = express.Router();

// GET /api/content?type=guides&lang=it
// Restituisce la lista dei contenuti pubblicati per tipo e lingua.
router.get('/', async (req, res) => {
  const { type, lang = 'it' } = req.query;
  if (!type) return res.status(400).json({ error: 'type is required' });

  try {
    const prefix = `content/published/${type}/${lang}/`;
    const keys = await listKeys(prefix);
    const items = await Promise.all(
      keys
        .filter((k) => k.endsWith('.json'))
        .map(async (k) => {
          const data = await getJson(k);
          return data;
        })
    );
    res.json(items.filter(Boolean));
  } catch (err) {
    console.error('[content] list error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/content/:type/:id?lang=it
// Dettaglio singolo contenuto pubblicato.
router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const { lang = 'it' } = req.query;
  const key = `content/published/${type}/${lang}/${id}.json`;
  try {
    const data = await getJson(key);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    console.error('[content] get error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
