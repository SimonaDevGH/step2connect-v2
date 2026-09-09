const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

function loadAdminRouterWithMemoryStorage() {
  const originalLoad = Module._load;
  const routes = { get: [], put: [], post: [] };
  const objects = new Map();
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
      const multer = () => ({ single: () => (_req, _res, next) => next() });
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

test('uploaded image filenames use page ID and public language suffix', async () => {
  const { objects, uploadImage } = loadAdminRouterWithMemoryStorage();
  const previousBucket = process.env.S3_BUCKET_NAME;
  const previousRegion = process.env.AWS_REGION;
  process.env.S3_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'eu-west-1';

  try {
    const italian = response();
    await uploadImage({
      params: { type: 'guides', id: 'documenti-casa' },
      query: { lang: 'it' },
      file: { buffer: Buffer.from('it'), mimetype: 'image/jpeg' },
    }, italian);
    assert.equal(italian.code, 200);
    assert.equal(
      italian.body.key,
      'step2connect/img/guides/documenti-casa/documenti-casa_it.png',
    );
    assert.match(italian.body.url, /documenti-casa_it\.png\?v=\d+$/);

    const bengali = response();
    await uploadImage({
      params: { type: 'guides', id: 'documenti-casa' },
      query: { lang: 'bn' },
      file: { buffer: Buffer.from('bd'), mimetype: 'image/jpeg' },
    }, bengali);
    assert.equal(
      bengali.body.key,
      'step2connect/img/guides/documenti-casa/documenti-casa_bd.png',
    );

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