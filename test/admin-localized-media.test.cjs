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
    post(path, handler) { routes.post.push({ path, handler }); },
    delete() {},
  };
  const s3 = {
    async getJson(key) {
      return objects.get(key) || null;
    },
    async putJson(key, value) {
      objects.set(key, value);
    },
    async putBuffer() {},
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