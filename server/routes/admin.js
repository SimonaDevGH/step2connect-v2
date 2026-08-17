/**
 * Route admin — CRUD contenuti su S3.
 * Tutte protette da requireAdminJWT (login email+password CMS).
 */
const express = require('express');
const multer  = require('multer');
const mime    = require('mime-types');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { getJson, putJson, putBuffer, listKeys, copyObject } = require('../lib/s3');
const { validateContent } = require('../lib/validate');

const router = express.Router();

// Multer in memoria (max 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato immagine non supportato (jpeg, png, webp, gif)'));
  },
});

// Applica auth JWT su tutte le route di questo router
router.use(requireAdminJWT);

// ── LIST ─────────────────────────────────────────────────────────────────────
// GET /api/admin/content?type=guides&lang=it
router.get('/', async (req, res) => {
  const { type, lang = 'it' } = req.query;
  if (!type) return res.status(400).json({ error: 'type is required' });

  try {
    const prefix = `content/draft/${type}/${lang}/`;
    const keys   = await listKeys(prefix);
    const items  = await Promise.all(
      keys.filter((k) => k.endsWith('.json')).map((k) => getJson(k))
    );
    res.json(items.filter(Boolean));
  } catch (err) {
    console.error('[admin] list error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
// GET /api/admin/content/:type/:id — restituisce draft multi-lingua
router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    const [it, en, bn] = await Promise.all([
      getJson(`content/draft/${type}/it/${id}.json`),
      getJson(`content/draft/${type}/en/${id}.json`),
      getJson(`content/draft/${type}/bn/${id}.json`),
    ]);
    if (!it && !en && !bn) return res.status(404).json({ error: 'Not found' });
    const base = it || en || bn;
    res.json({
      id:        base.id,
      type:      base.type,
      category:  base.category || '',
      emoji:     base.emoji || '📄',
      imageUrl:  base.imageUrl || '',
      url:       base.url || '',
      it: it  ? { title: it.title,  body: it.body,  audioUrl: it.audioUrl  || '', metaDesc: it.metaDesc  || '' }
              : { title: '',        body: '',        audioUrl: '',               metaDesc: '' },
      en: en  ? { title: en.title,  body: en.body,  audioUrl: en.audioUrl  || '', metaDesc: en.metaDesc  || '' }
              : { title: '',        body: '',        audioUrl: '',               metaDesc: '' },
      bn: bn  ? { title: bn.title,  body: bn.body,  audioUrl: bn.audioUrl  || '', metaDesc: bn.metaDesc  || '' }
              : { title: '',        body: '',        audioUrl: '',               metaDesc: '' },
      updatedBy: base.updatedBy || '',
      updatedAt: base.updatedAt || '',
    });
  } catch (err) {
    console.error('[admin] get error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT (crea / aggiorna draft) ───────────────────────────────────────────────
// PUT /api/admin/content/:type/:id
router.put('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const now    = new Date().toISOString();
  const author = adminUserId(req);

  try {
    const payload = validateContent({ ...req.body, id, type });
    for (const lang of ['it', 'en', 'bn']) {
      const key = `content/draft/${type}/${lang}/${id}.json`;
      await putJson(key, {
        id,
        type,
        lang,
        category:  payload.category,
        emoji:     payload.emoji,
        imageUrl:  payload.imageUrl || '',
        url:       payload.url      || '',
        title:     payload[lang].title,
        body:      payload[lang].body,
        audioUrl:  payload[lang].audioUrl || '',
        metaDesc:  payload[lang].metaDesc || '',
        updatedBy: author,
        updatedAt: now,
      });
    }
    res.json({ ok: true, updatedAt: now });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[admin] put error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUBLISH ───────────────────────────────────────────────────────────────────
// POST /api/admin/content/:type/:id/publish
router.post('/:type/:id/publish', async (req, res) => {
  const { type, id } = req.params;
  try {
    for (const lang of ['it', 'en', 'bn']) {
      const draft     = `content/draft/${type}/${lang}/${id}.json`;
      const published = `content/published/${type}/${lang}/${id}.json`;
      const data = await getJson(draft);
      if (!data) continue;
      await copyObject(draft, published);
    }
    res.json({ ok: true, publishedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[admin] publish error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE (archivia, non elimina) ────────────────────────────────────────────
// DELETE /api/admin/content/:type/:id
router.delete('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    for (const lang of ['it', 'en', 'bn']) {
      const src = `content/draft/${type}/${lang}/${id}.json`;
      const dst = `content/archive/${type}/${lang}/${id}_${ts}.json`;
      const data = await getJson(src);
      if (data) await copyObject(src, dst);
    }
    res.json({ ok: true, archivedAt: ts });
  } catch (err) {
    console.error('[admin] delete error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── MEDIA UPLOAD ──────────────────────────────────────────────────────────────
// POST /api/admin/content/:type/:id/media
// Salva in step2connect/img/{type}/{id}/{timestamp}.{ext}
router.post('/:type/:id/media', upload.single('file'), async (req, res) => {
  const { type, id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = mime.extension(req.file.mimetype) || 'bin';
  const key = `step2connect/img/${type}/${id}/${Date.now()}.${ext}`;
  try {
    await putBuffer(key, req.file.buffer, req.file.mimetype);
    const region = process.env.AWS_REGION || 'eu-west-2';
    const bucket = process.env.S3_BUCKET_NAME;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    res.json({ ok: true, url, key });
  } catch (err) {
    console.error('[admin] media upload error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
