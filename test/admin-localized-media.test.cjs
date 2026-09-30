const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

function loadAdminRouterWithMemoryStorage() {
  const originalLoad = Module._load;
  const routes = { get: [], put: [], post: [] };
  const objects = new Map();
  let uploadOptions;
  const router = {
    use() {},
    get(path, handler) { routes.get.push({ path, handler }); },
    put(path, handler) { routes.put.push({ path, handler }); },
    post(path, ...handlers) {
      routes.post.push({ path, handler: handlers.at(-1), handlers });
    },
    delete() {},
  };
  const s3 = {
    async getJson(key) {
      return objects.get(key) || null;
    },
    async putJson(key, value) {
      objects.set(key, value);
    },
    async putBuffer(key, buffer, contentType) {
      objects.set(key, { buffer, contentType });
    },
    async listKeys() {
      return [];
    },
    async copyObject(source, target) {
      objects.set(target, structuredClone(objects.get(source)));
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };

  Module._load = function loadMockedModule(request, parent, isMain) {
    if (request === 'express') return { Router: () => router };
    if (request === 'multer') {
      const multer = (options) => {
        uploadOptions = options;
        return { single: () => (_req, _res, next) => next() };
      };
      multer.memoryStorage = () => ({});
      return multer;
    }
    if (request === 'mime-types') return { extension: () => 'png' };
    if (request === '../middleware/adminAuth') {
      return {
        requireAdminJWT: (_req, _res, next) => next(),
        adminUserId: () => 'test-admin',
      };
    }
    if (request === '../lib/s3') return s3;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve('../server/routes/admin')];
    require('../server/routes/admin');
  } finally {
    Module._load = originalLoad;
  }

  return {
    objects,
    getOne: routes.get.find(({ path }) => path === '/:type/:id').handler,
    save: routes.put.find(({ path }) => path === '/:type/:id').handler,
    publish: routes.post.find(({ path }) => path === '/:type/:id/publish').handler,
    uploadImage: routes.post.find(({ path }) => path === '/:type/:id/media').handler,
    getUploadOptions: () => uploadOptions,
  };
}

function response() {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const url = (file) => `https://cdn.example/${file}`;
const key = (state, lang, id) => `content/${state}/guides/${lang}/${id}.json`;
const siteKey = (state, lang) => `content/${state}/site/${lang}/app-images.json`;

test('localized media survive save, reopen, publish, and legacy fallback', async () => {
  const { objects, getOne, save, publish } = loadAdminRouterWithMemoryStorage();
  const id = 'localized-media';

  const saved = response();
  await save({
    params: { type: 'guides', id },
    body: {
      id,
      category: 'documents',
      emoji: '📄',
      imageUrl: url('legacy.png'),
      videoUrl: url('legacy.mp4'),
      it: {
        title: 'Italiano',
        body: '',
        audioUrl: url('it.mp3'),
        videoUrl: url('it.mp4'),
        emoji: '🇮🇹',
        imageUrl: url('it.png'),
      },
      en: {
        title: 'English',
        body: '',
        audioUrl: '',
        videoUrl: '',
        emoji: '',
        imageUrl: '',
      },
      bn: {
        title: 'বাংলা',
        body: '',
        audioUrl: url('bn.mp3'),
      },
    },
  }, saved);
  assert.equal(saved.code, 200);

  assert.deepEqual(
    {
      audioUrl: objects.get(key('draft', 'en', id)).audioUrl,
      videoUrl: objects.get(key('draft', 'en', id)).videoUrl,
      emoji: objects.get(key('draft', 'en', id)).emoji,
      imageUrl: objects.get(key('draft', 'en', id)).imageUrl,
    },
    { audioUrl: '', videoUrl: '', emoji: '', imageUrl: '' },
  );

  const reopened = response();
  await getOne({ params: { type: 'guides', id } }, reopened);
  assert.equal(reopened.code, 200);
  assert.deepEqual(
    {
      audioUrl: reopened.body.en.audioUrl,
      videoUrl: reopened.body.en.videoUrl,
      emoji: reopened.body.en.emoji,
      imageUrl: reopened.body.en.imageUrl,
    },
    { audioUrl: '', videoUrl: '', emoji: '', imageUrl: '' },
  );
  assert.equal(reopened.body.it.videoUrl, url('it.mp4'));
  assert.equal(reopened.body.bn.audioUrl, url('bn.mp3'));

  const published = response();
  await publish({ params: { type: 'guides', id } }, published);
  assert.equal(published.code, 200);
  assert.deepEqual(
    {
      audioUrl: objects.get(key('published', 'en', id)).audioUrl,
      videoUrl: objects.get(key('published', 'en', id)).videoUrl,
      emoji: objects.get(key('published', 'en', id)).emoji,
      imageUrl: objects.get(key('published', 'en', id)).imageUrl,
    },
    { audioUrl: '', videoUrl: '', emoji: '', imageUrl: '' },
  );

  objects.clear();
  objects.set(key('draft', 'it', 'legacy'), {
    id: 'legacy',
    type: 'guides',
    title: 'Italiano',
    audioUrl: url('it.mp3'),
    videoUrl: url('legacy.mp4'),
    emoji: '📄',
    imageUrl: url('legacy.png'),
  });
  objects.set(key('draft', 'en', 'legacy'), {
    id: 'legacy',
    type: 'guides',
    title: 'English',
  });

  const legacy = response();
  await getOne({ params: { type: 'guides', id: 'legacy' } }, legacy);
  assert.equal(legacy.body.en.audioUrl, '');
  assert.equal(legacy.body.en.videoUrl, url('legacy.mp4'));
  assert.equal(legacy.body.en.emoji, '📄');
  assert.equal(legacy.body.en.imageUrl, url('legacy.png'));
});

test('site images stay separated by language through save, reopen, and publish', async () => {
  const { objects, getOne, save, publish } = loadAdminRouterWithMemoryStorage();
  const id = 'app-images';
  const payload = {
    id,
    category: '',
    it: {
      title: 'Immagini applicazione',
      assets: {
        homeHero: url('home-it.jpg'),
        guidesHero: url('guides-it.jpg'),
      },
    },
    en: {
      title: 'Application images',
      assets: {
        homeHero: url('home-en.jpg'),
        guidesHero: '',
      },
    },
    bn: {
      title: 'অ্যাপ্লিকেশন ছবি',
      assets: {
        homeHero: url('home-bn.jpg'),
      },
    },
  };

  const saved = response();
  await save({
    params: { type: 'site', id },
    body: payload,
  }, saved);
  assert.equal(saved.code, 200);
  assert.equal(objects.get(siteKey('draft', 'it')).assets.homeHero, url('home-it.jpg'));
  assert.equal(objects.get(siteKey('draft', 'en')).assets.homeHero, url('home-en.jpg'));
  assert.equal(objects.get(siteKey('draft', 'en')).assets.guidesHero, '');
  assert.equal(objects.get(siteKey('draft', 'bn')).assets.homeHero, url('home-bn.jpg'));

  const reopened = response();
  await getOne({ params: { type: 'site', id } }, reopened);
  assert.equal(reopened.code, 200);
  assert.deepEqual(reopened.body.it.assets, payload.it.assets);
  assert.deepEqual(reopened.body.en.assets, payload.en.assets);
  assert.deepEqual(reopened.body.bn.assets, payload.bn.assets);

  const published = response();
  await publish({ params: { type: 'site', id } }, published);
  assert.equal(published.code, 200);
  assert.equal(objects.get(siteKey('published', 'it')).assets.homeHero, url('home-it.jpg'));
  assert.equal(objects.get(siteKey('published', 'en')).assets.homeHero, url('home-en.jpg'));
  assert.equal(objects.get(siteKey('published', 'bn')).assets.homeHero, url('home-bn.jpg'));
});

test('uploaded files use content ID, language and media type; site slots keep existing image names', async () => {
  const { objects, uploadImage } = loadAdminRouterWithMemoryStorage();
  const previousBucket = process.env.S3_BUCKET_NAME;
  const previousRegion = process.env.AWS_REGION;
  process.env.S3_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'eu-west-1';

  try {
    const formats = {
      img: ['image/jpeg', 'jpg'],
      audio: ['audio/mpeg', 'mp3'],
      video: ['video/mp4', 'mp4'],
    };
    for (const [lang, suffix] of [['it', 'IT'], ['en', 'EN'], ['bn', 'BN']]) {
      for (const [kind, [mimetype, ext]] of Object.entries(formats)) {
        const result = response();
        const buffer = Buffer.from(`${lang}-${kind}`);
        await uploadImage({
          params: { type: 'guides', id: 'permitRenewal' },
          query: { lang, mediaType: kind },
          file: { buffer, size: buffer.length, mimetype },
        }, result);
        assert.equal(result.code, 200);
        assert.equal(
          result.body.key,
          `step2connect/img/guides/permitRenewal/permitRenewal_${suffix}_${kind}.${ext}`,
        );
        assert.match(result.body.url, new RegExp(`permitRenewal_${suffix}_${kind}\\.${ext}\\?v=\\d+$`));
        assert.equal(objects.get(result.body.key).contentType, mimetype);
      }
    }

    const siteSlot = response();
    await uploadImage({
      params: { type: 'site', id: 'app-images' },
      query: { lang: 'en', slot: 'homeHero' },
      file: { buffer: Buffer.from('en'), mimetype: 'image/png' },
    }, siteSlot);
    assert.equal(
      siteSlot.body.key,
      'step2connect/img/site/app-images/app-images_homeHero_en.png',
    );
    assert.equal(objects.has(siteSlot.body.key), true);
  } finally {
    if (previousBucket === undefined) delete process.env.S3_BUCKET_NAME;
    else process.env.S3_BUCKET_NAME = previousBucket;
    if (previousRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = previousRegion;
  }
});

test('media upload rejects mismatched formats, oversized files and invalid languages', async () => {
  const { uploadImage, getUploadOptions } = loadAdminRouterWithMemoryStorage();
  const options = getUploadOptions();
  const accepts = (query, mimetype) => new Promise((resolve) =>
    options.fileFilter({ query }, { mimetype }, (err, accepted) => resolve({ err, accepted }))
  );
  assert.equal((await accepts({ mediaType: 'audio' }, 'audio/mpeg')).accepted, true);
  assert.match((await accepts({ mediaType: 'video' }, 'audio/mpeg')).err.message, /non supportato/);
  assert.match((await accepts({ mediaType: 'img' }, 'video/mp4')).err.message, /non supportato/);

  const invalid = response();
  await uploadImage({
    params: { type: 'guides', id: 'permitRenewal' },
    query: { lang: 'it', mediaType: 'audio' },
    file: { buffer: Buffer.from('no'), mimetype: 'video/mp4' },
  }, invalid);
  assert.equal(invalid.code, 400);

  const oversized = response();
  await uploadImage({
    params: { type: 'guides', id: 'permitRenewal' },
    query: { lang: 'en', mediaType: 'audio' },
    file: { buffer: Buffer.from('no'), size: 26 * 1024 * 1024, mimetype: 'audio/mpeg' },
  }, oversized);
  assert.equal(oversized.code, 413);

  const language = response();
  await uploadImage({
    params: { type: 'guides', id: 'permitRenewal' },
    query: { lang: 'xx', mediaType: 'img' },
    file: { buffer: Buffer.from('no'), mimetype: 'image/png' },
  }, language);
  assert.equal(language.code, 400);
});

test('featured service guide belongs to guides and preserves its chosen order', async () => {
  const { objects, getOne, save } = loadAdminRouterWithMemoryStorage();
  const id = 'guida-al-servizio';
  const saved = response();

  await save({
    params: { type: 'guides', id },
    body: {
      id,
      category: 'documents',
      sortOrder: '2',
      it: { title: 'Guida al servizio' },
      en: { title: 'Service guide' },
      bn: { title: 'সেবা নির্দেশিকা' },
    },
  }, saved);

  assert.equal(saved.code, 200);
  assert.equal(saved.body.url, '/guides/guida-al-servizio');
  assert.equal(objects.get(key('draft', 'it', id)).category, 'guides');
  assert.equal(objects.get(key('draft', 'it', id)).sortOrder, 2);

  const reopened = response();
  await getOne({ params: { type: 'guides', id } }, reopened);
  assert.equal(reopened.body.category, 'guides');
  assert.equal(reopened.body.sortOrder, 2);
});