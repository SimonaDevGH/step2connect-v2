const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');

async function fixture(t) {
  const objects = new Map();
  const writes = [];
  const storage = {
    async getJson(key) { return structuredClone(objects.get(key) ?? null); },
    async putJson(key, value) { writes.push(key); objects.set(key, structuredClone(value)); },
    async listKeys(prefix) { return [...objects.keys()].filter((key) => key.startsWith(prefix)); },
    async copyObject(from, to) {
      assert.ok(objects.has(from));
      writes.push(to);
      objects.set(to, structuredClone(objects.get(from)));
    },
    async deleteObject(key) { objects.delete(key); },
    async putBuffer() { throw new Error('Unexpected upload'); },
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if ((request === './s3' && parent.filename.endsWith('/lib/sections.js'))
      || request === '../lib/s3') return storage;
    return originalLoad.call(this, request, parent, isMain);
  };
  let sectionStore, sectionRoutes, adminRouter;
  try {
    for (const path of ['../server/lib/sections', '../server/routes/sections', '../server/routes/admin']) {
      delete require.cache[require.resolve(path)];
    }
    sectionStore = require('../server/lib/sections');
    sectionRoutes = require('../server/routes/sections');
    adminRouter = require('../server/routes/admin');
  } finally { Module._load = originalLoad; }
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'visibility-test-fixture-only';
  const token = jwt.sign({ kind: 'cms-admin', email: 'cms@example.invalid' },
    process.env.SESSION_SECRET, { issuer: 'step2connect-cms', audience: 'cms-admin', expiresIn: '1h' });
  const app = express();
  app.use(express.json());
  app.use('/api/sections', sectionRoutes.publicRouter);
  app.use('/api/admin/sections', sectionRoutes.adminRouter);
  app.use('/api/admin/content', adminRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
  const api = async (path, method = 'GET', body, credential = token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { objects, writes, sectionStore, api };
}

const contentKey = (state, lang, id = 'page') => `content/${state}/guides/${lang}/${id}.json`;
const payload = (id = 'page') => ({
  id, category: 'documents',
  it: { title: 'Titolo IT', body: '<p>Italiano</p>' },
  en: { title: 'Title EN', body: '<p>English</p>' },
  bn: { title: 'Title BN', body: '<p>Bangla</p>' },
});

test('missing/invalid section configuration returns exact defaults without writing S3', async (t) => {
  const { objects, writes, sectionStore, api } = await fixture(t);
  const frontend = await import('../src/lib/sectionAccess.js');
  assert.deepEqual(sectionStore.DEFAULT_SECTIONS, frontend.DEFAULT_SECTIONS);
  for (const value of [undefined, [], 'invalid', { quiz: { status: 'unknown' } }]) {
    if (value === undefined) objects.delete('config/sections.json');
    else objects.set('config/sections.json', value);
    const result = await api('/api/sections', 'GET', null, null);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.sections, frontend.DEFAULT_SECTIONS);
  }
  assert.equal(writes.length, 0);
});

test('CMS saves section status and audit metadata on S3; rejects invalid input and non-CMS credentials', async (t) => {
  const { objects, api } = await fixture(t);
  for (const [path, body] of [
    ['/home', { status: 'internal' }],
    ['/quiz', { status: 'draft' }],
    ['/quiz', {}],
    ['/__proto__', { status: 'published' }],
  ]) {
    assert.equal((await api(`/api/admin/sections${path}`, 'PUT', body)).status, 400);
  }
  assert.equal((await api('/api/admin/sections/quiz', 'PUT', { status: 'preview' }, null)).status, 401);
  const preview = jwt.sign({ kind: 'preview-session', type: 'admin' },
    process.env.SESSION_SECRET, { issuer: 'step2connect-preview', audience: 'preview-admin' });
  assert.equal((await api('/api/admin/sections/quiz', 'PUT', { status: 'preview' }, preview)).status, 401);
  const result = await api('/api/admin/sections/quiz', 'PUT', { status: 'preview' });
  assert.equal(result.status, 200);
  assert.equal(objects.get('config/sections.json').quiz.status, 'preview');
  assert.equal(objects.get('config/sections.json').quiz.updatedBy, 'cms@example.invalid');
  assert.ok(Date.parse(objects.get('config/sections.json').quiz.updatedAt));
  assert.equal((await api('/api/sections')).body.sections.quiz.status, 'preview');
  assert.equal(objects.get('config/sections.json').guides.status, 'published');
});

test('new draft is internal in all languages; ordinary saves preserve visibility and ignore client overrides', async (t) => {
  const { objects, api } = await fixture(t);
  assert.equal((await api('/api/admin/content/guides/page', 'PUT', { ...payload(), visibility: 'published' })).status, 200);
  for (const lang of ['it', 'en', 'bn']) {
    assert.equal(objects.get(contentKey('draft', lang)).visibility, 'internal');
    assert.equal(objects.has(contentKey('published', lang)), false);
    objects.get(contentKey('draft', lang)).visibility = 'preview';
  }
  await api('/api/admin/content/guides/page', 'PUT', payload());
  for (const lang of ['it', 'en', 'bn']) {
    assert.equal(objects.get(contentKey('draft', lang)).visibility, 'preview');
  }
});

test('visibility selection publishes latest saved content in all languages with audit fields and rename cleanup', async (t) => {
  const { objects, api } = await fixture(t);
  await api('/api/admin/content/guides/page', 'PUT', payload());
  await api('/api/admin/content/guides/page/publish', 'POST');
  await api('/api/admin/content/guides/page', 'PUT', payload('renamed'));
  // Saving the renamed draft again must not lose the old URL cleanup marker.
  await api('/api/admin/content/guides/renamed', 'PUT', payload('renamed'));
  for (const visibility of ['internal', 'preview', 'published']) {
    const result = await api('/api/admin/content/guides/renamed/visibility', 'PUT', { visibility });
    assert.equal(result.status, 200);
    for (const lang of ['it', 'en', 'bn']) {
      const draft = objects.get(contentKey('draft', lang, 'renamed'));
      assert.equal(draft.visibility, visibility);
      assert.equal(draft.updatedBy, 'cms@example.invalid');
      assert.deepEqual(objects.get(contentKey('published', lang, 'renamed')), draft);
      assert.equal(objects.has(contentKey('published', lang)), false);
    }
  }
  const list = (await api('/api/admin/content?type=guides&lang=it')).body;
  assert.equal(list[0].visibility, 'published');
  assert.equal(list[0].hasUnpublishedChanges, false);
  await api('/api/admin/content/guides/renamed', 'PUT', {
    ...payload('renamed'), it: { title: 'Changed', body: '' },
  });
  assert.equal((await api('/api/admin/content?type=guides&lang=it')).body[0].hasUnpublishedChanges, true);
  await api('/api/admin/content/guides/renamed/publish', 'POST');
  assert.equal((await api('/api/admin/content?type=guides&lang=it')).body[0].hasUnpublishedChanges, false);
});

test('legacy online content without visibility remains published; online-only pages stay manageable', async (t) => {
  const { objects, api } = await fixture(t);
  for (const lang of ['it', 'en', 'bn']) {
    objects.set(contentKey('published', lang), {
      ...payload()[lang], type: 'guides', id: 'page', lang,
    });
  }
  const list = await api('/api/admin/content?type=guides&lang=it');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].visibility, 'published');
  assert.equal(list.body[0].status, 'published');
  assert.equal((await api('/api/admin/content/guides/page/visibility', 'PUT', { visibility: 'preview' })).status, 200);
  await api('/api/admin/content/guides/page', 'PUT', payload());
  assert.equal(objects.get(contentKey('draft', 'it')).visibility, 'preview');
});

test('visibility endpoint rejects unknown states/types, missing records and non-admin requests', async (t) => {
  const { objects, api } = await fixture(t);
  assert.equal((await api('/api/admin/content/guides/page/visibility', 'PUT', { visibility: 'internal' }, null)).status, 401);
  assert.equal((await api('/api/admin/content/site/page/visibility', 'PUT', { visibility: 'internal' })).status, 400);
  assert.equal((await api('/api/admin/content/guides/page/visibility', 'PUT', { visibility: 'draft' })).status, 400);
  assert.equal((await api('/api/admin/content/guides/page/visibility', 'PUT', { visibility: 'internal' })).status, 404);
  objects.set(contentKey('draft', 'it'), { id: 'page', type: 'guides', lang: 'it' });
  assert.equal((await api('/api/admin/content/guides/page/visibility', 'PUT', { visibility: 'internal' })).status, 409);
  assert.equal(objects.has(contentKey('published', 'it')), false);
});

test('role matrix enforces BOTH section and page visibility, with published legacy pages', async () => {
  const { canSeeVisibility, canSeeSection, DEFAULT_SECTIONS } = await import('../src/lib/sectionAccess.js');
  const sections = { ...DEFAULT_SECTIONS, quiz: { status: 'preview' } };
  for (const type of ['admin', 'fincantieri_users', 'standard', undefined, '']) {
    const user = { type };
    assert.equal(canSeeSection('home', user, sections), true);
    assert.equal(canSeeSection('offices', user, sections), type === 'admin');
    assert.equal(canSeeSection('quiz', user, sections), ['admin', 'fincantieri_users'].includes(type));
    assert.equal(canSeeVisibility('internal', user), type === 'admin');
    assert.equal(canSeeVisibility('preview', user), ['admin', 'fincantieri_users'].includes(type));
    assert.equal(canSeeVisibility(undefined, user), true);
    for (const sectionStatus of ['internal', 'preview', 'published']) {
      for (const pageStatus of ['internal', 'preview', 'published']) {
        const rank = { internal: 2, preview: 1, published: 0 };
        const level = type === 'admin' ? 2 : type === 'fincantieri_users' ? 1 : 0;
        assert.equal(
          canSeeSection('guides', user, { guides: { status: sectionStatus } })
            && canSeeVisibility(pageStatus, user),
          level >= Math.max(rank[sectionStatus], rank[pageStatus]),
        );
      }
    }
  }
});
