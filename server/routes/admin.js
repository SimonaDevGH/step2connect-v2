/**
 * Route admin — CRUD contenuti su S3.
 * Tutte protette da requireAdminJWT (login email+password CMS).
 */
const express = require('express');
const multer  = require('multer');
const { requireAdminJWT, adminUserId } = require('../middleware/adminAuth');
const { getJson, putJson, putBuffer, listKeys, copyObject, deleteObject } = require('../lib/s3');
const { validateContent } = require('../lib/validate');

const router = express.Router();
const CONTENT_TYPES = ['guides', 'news', 'library', 'pages', 'site'];
const LIST_LANGUAGES = ['it', 'en', 'bn'];
const FILE_LANGUAGE_CODES = { it: 'it', en: 'en', bn: 'bd' };
const FEATURED_SERVICE_GUIDE_ID = 'guida-al-servizio';
const hasOwn = (value, key) => Boolean(
  value && Object.prototype.hasOwnProperty.call(value, key)
);
const localizedOrLegacy = (translation, field, legacyValue) => (
  hasOwn(translation, field) ? translation[field] : legacyValue
);

const MEDIA_FORMATS = {
  img: {
    'image/jpeg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif',
  },
  audio: {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg',
  },
  video: {
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'video/quicktime': 'mov',
  },
};
const MEDIA_LIMITS = {
  img: 5 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

// Multer in memoria; limite massimo complessivo, con limite specifico per tipo sotto.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_LIMITS.video },
  fileFilter: (req, file, cb) => {
    const kind = req.query.mediaType || 'img';
    if (!MEDIA_FORMATS[kind]?.[file.mimetype]) {
      return cb(new Error(`Formato ${kind} non supportato`));
    }
    cb(null, true);
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
      assets: record?.assets && typeof record.assets === 'object' ? record.assets : {},
    });
    res.json({
      id:        base.id,
      type:      base.type,
      category:  base.id === FEATURED_SERVICE_GUIDE_ID ? 'guides' : (base.category || ''),
      sortOrder: base.sortOrder ?? '',
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
    const category = type === 'guides' && id === FEATURED_SERVICE_GUIDE_ID
      ? 'guides'
      : payload.category;

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
      ? (category === 'guides' ? `/guides/${id}` : `/guides/${category}/${id}`)
      : (payload.url || '');

    for (const lang of ['it', 'en', 'bn']) {
      const key = `content/draft/${type}/${lang}/${id}.json`;
      await putJson(key, {
        id,
        type,
        lang,
        category,
        sortOrder: payload.sortOrder,
        emoji:     localizedOrLegacy(payload[lang], 'emoji', payload.emoji),
        audioUrl:  localizedOrLegacy(payload[lang], 'audioUrl', ''),
        imageUrl:  localizedOrLegacy(payload[lang], 'imageUrl', payload.imageUrl || ''),
        videoUrl:  localizedOrLegacy(payload[lang], 'videoUrl', payload.videoUrl || ''),
        assets:    payload[lang].assets || {},
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
      const issues = (err.issues || err.errors || []).map((issue) => ({
        path: issue.path || [],
        code: issue.code,
        message: issue.message,
        validation: issue.validation,
        format: issue.format,
        minimum: issue.minimum,
        maximum: issue.maximum,
      }));
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: issues,
      });
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
// Per i contenuti editoriali: {id}_{LINGUA}_{img|audio|video}.{ext}.
// La configurazione site conserva le chiavi immagini esistenti per non spezzare i link.
router.post('/:type/:id/media', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? 'File troppo grande (massimo 100 MB)' : err.message,
      });
    }
    next();
  });
}, async (req, res) => {
  const { type, id } = req.params;
  const { lang, slot = '', mediaType = 'img' } = req.query;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }
  if (!FILE_LANGUAGE_CODES[lang]) {
    return res.status(400).json({ error: 'Invalid language' });
  }
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid content ID' });
  }
  if (!MEDIA_FORMATS[mediaType] || !MEDIA_FORMATS[mediaType][req.file.mimetype]) {
    return res.status(400).json({ error: 'Formato o tipo di file non supportato' });
  }
  if (req.file.size > MEDIA_LIMITS[mediaType] || req.file.buffer.length > MEDIA_LIMITS[mediaType]) {
    return res.status(413).json({ error: `File troppo grande per ${mediaType}` });
  }
  if (slot && (type !== 'site' || mediaType !== 'img' || !/^[A-Za-z0-9-]+$/.test(slot))) {
    return res.status(400).json({ error: 'Invalid image slot' });
  }
  if (type === 'site' && mediaType !== 'img') {
    return res.status(400).json({ error: 'Solo immagini per la configurazione app' });
  }

  const ext = MEDIA_FORMATS[mediaType][req.file.mimetype];
  const filename = type === 'site'
    ? `${id}${slot ? `_${slot}` : ''}_${FILE_LANGUAGE_CODES[lang]}.${ext}`
    : `${id}_${lang.toUpperCase()}_${mediaType}.${ext}`;
  const key = `step2connect/img/${type}/${id}/${filename}`;
  try {
    await putBuffer(key, req.file.buffer, req.file.mimetype);
    const region = process.env.AWS_REGION || 'eu-west-2';
    const bucket = process.env.S3_BUCKET_NAME;
    // La chiave è stabile; la query forza il browser a scaricare la nuova versione.
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}?v=${Date.now()}`;
    res.json({ ok: true, url, key });
  } catch (err) {
    console.error('[admin] media upload error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
