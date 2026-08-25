/**
 * Route admin — CRUD contenuti su S3.
 * Tutte protette da requireAdminJWT (login email+password CMS).
 */
const express = require('express');
const multer  = require('multer');
const mime    = require('mime-types');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { getJson, putJson, putBuffer, listKeys, copyObject, deleteObject } = require('../lib/s3');
const { validateContent } = require('../lib/validate');

const router = express.Router();
const CONTENT_TYPES = ['guides', 'news', 'library', 'pages'];
const LIST_LANGUAGES = ['it', 'en', 'bn'];
const hasOwn = (value, key) => Boolean(
  value && Object.prototype.hasOwnProperty.call(value, key)
);
const localizedOrLegacy = (translation, field, legacyValue) => (
  hasOwn(translation, field) ? translation[field] : legacyValue
);

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
// GET /api/admin/content?type=guides|news|library|pages|all&lang=it
// `all` è la vista riepilogativa dell'admin (guide, news e library).
router.get('/', async (req, res) => {
  const { type, lang = 'it' } = req.query;
  if (!CONTENT_TYPES.includes(type) && type !== 'all') {
    return res.status(400).json({ error: 'Invalid content type' });
  }
  if (!LIST_LANGUAGES.includes(lang)) {
    return res.status(400).json({ error: 'Invalid language' });
  }

  try {
    const typesToList = type === 'all' ? ['guides', 'news', 'library'] : [type];
    const [draftKeyGroups, publishedKeyGroups] = await Promise.all([
      Promise.all(typesToList.map((contentType) =>
        listKeys(`content/draft/${contentType}/${lang}/`)
      )),
      Promise.all(typesToList.map((contentType) =>
        listKeys(`content/published/${contentType}/${lang}/`)
      )),
    ]);
    const publishedKeys = new Set(publishedKeyGroups.flat());
    const draftRecords = draftKeyGroups.flatMap((keys, index) =>
      keys
        .filter((key) => key.endsWith('.json'))
        .map((key) => ({ key, type: typesToList[index] }))
    );
    const items = await Promise.all(draftRecords.map(async ({ key, type: contentType }) => {
      const item = await getJson(key);
      if (!item) return null;

      return {
        ...item,
        type: item.type || contentType,
        status: publishedKeys.has(key.replace('content/draft/', 'content/published/'))
          ? 'published'
          : 'draft',
      };
    }));

    res.json(items
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    );
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
    const legacyVideoUrl = base.videoUrl || '';
    const translation = (record) => ({
      title: record?.title || '',
      body: record?.body || '',
      // L'audio è localizzato fin dal formato precedente: non usare mai
      // l'audio di un'altra lingua come fallback.
      audioUrl: localizedOrLegacy(record, 'audioUrl', ''),
      // Compatibilità con il precedente formato, in cui il video era globale.
      videoUrl: localizedOrLegacy(record, 'videoUrl', legacyVideoUrl),
      metaDesc: record?.metaDesc || '',
      // Immagine e icona erano in precedenza mostrate una sola volta nel form.
      emoji: localizedOrLegacy(record, 'emoji', base.emoji || '📄'),
      imageUrl: localizedOrLegacy(record, 'imageUrl', base.imageUrl || ''),
    });
    res.json({
      id:        base.id,
      type:      base.type,
      category:  base.category || '',
      emoji:     base.emoji || '📄',
      imageUrl:  base.imageUrl || '',
      videoUrl:  base.videoUrl || '',
      url:       base.url || '',
      it: translation(it),
      en: translation(en),
      bn: translation(bn),
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
  const { type, id: previousId } = req.params;
  const now    = new Date().toISOString();
  const author = adminUserId(req);

  try {
    const payload = validateContent({ ...req.body, type });
    const id = payload.id;
    const isRename = previousId !== id;

    // Una rinomina non deve sovrascrivere per errore un contenuto esistente.
    if (isRename) {
      const targetKeys = ['it', 'en', 'bn'].flatMap((lang) => [
        `content/draft/${type}/${lang}/${id}.json`,
        `content/published/${type}/${lang}/${id}.json`,
      ]);
      const existing = await Promise.all(targetKeys.map((key) => getJson(key)));
      if (existing.some(Boolean)) {
        return res.status(409).json({ error: `L'ID "${id}" è già in uso` });
      }
    }

    // Per le guide il percorso pubblico è sempre derivato da categoria + ID.
    // Questo evita che JSON, card e route possano finire su URL diversi.
    const publicUrl = type === 'guides'
      ? `/guides/${payload.category}/${id}`
      : (payload.url || '');

    for (const lang of ['it', 'en', 'bn']) {
      const key = `content/draft/${type}/${lang}/${id}.json`;
      await putJson(key, {
        id,
        type,
        lang,
        category:  payload.category,
        emoji:     localizedOrLegacy(payload[lang], 'emoji', payload.emoji),
        audioUrl:  localizedOrLegacy(payload[lang], 'audioUrl', ''),
        imageUrl:  localizedOrLegacy(payload[lang], 'imageUrl', payload.imageUrl || ''),
        videoUrl:  localizedOrLegacy(payload[lang], 'videoUrl', payload.videoUrl || ''),
        url:       publicUrl,
        title:     payload[lang].title,
        body:      payload[lang].body,
        metaDesc:  payload[lang].metaDesc || '',
        renamedFrom: isRename ? previousId : '',
        updatedBy: author,
        updatedAt: now,
      });
    }

    // Il vecchio draft non deve più apparire nell'elenco admin dopo la rinomina.
    // Il vecchio contenuto pubblicato resta online fino al successivo "Pubblica".
    if (isRename) {
      await Promise.all(['it', 'en', 'bn'].map((lang) =>
        deleteObject(`content/draft/${type}/${lang}/${previousId}.json`)
      ));
    }

    res.json({ ok: true, id, url: publicUrl, renamed: isRename, updatedAt: now });
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
    let renamedFrom = '';
    for (const lang of ['it', 'en', 'bn']) {
      const draft     = `content/draft/${type}/${lang}/${id}.json`;
      const published = `content/published/${type}/${lang}/${id}.json`;
      const data = await getJson(draft);
      if (!data) continue;
      renamedFrom = renamedFrom || data.renamedFrom || '';
      await copyObject(draft, published);
    }

    // Dopo avere pubblicato tutte le nuove lingue, disattiva il vecchio URL.
    if (renamedFrom && renamedFrom !== id) {
      await Promise.all(['it', 'en', 'bn'].map((lang) =>
        deleteObject(`content/published/${type}/${lang}/${renamedFrom}.json`)
      ));
    }

    res.json({ ok: true, publishedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[admin] publish error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE (rimuove bozza e versione pubblicata) ───────────────────────────────
// DELETE /api/admin/content/:type/:id
router.delete('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    for (const lang of ['it', 'en', 'bn']) {
      const draft = `content/draft/${type}/${lang}/${id}.json`;
      const published = `content/published/${type}/${lang}/${id}.json`;
      const archive = `content/archive/${type}/${lang}/${id}_${ts}.json`;
      const data = await getJson(draft);

      // Conserva una copia della bozza per recuperi amministrativi, ma elimina
      // tutte le chiavi attive: il contenuto e il suo URL non saranno più esposti.
      if (data) await copyObject(draft, archive);
      await Promise.all([deleteObject(draft), deleteObject(published)]);
    }
    res.json({ ok: true, deletedAt: ts });
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
