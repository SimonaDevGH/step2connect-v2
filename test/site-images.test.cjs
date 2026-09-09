const assert = require('node:assert/strict');
const test = require('node:test');

test('site image configuration keeps known URLs and falls back for empty fields', async () => {
  const {
    DEFAULT_SITE_IMAGES,
    SITE_IMAGE_SLOTS,
    normalizeSiteImages,
  } = await import('../src/lib/siteImages.js');

  const customHome = 'https://cdn.example/home-en.jpg';
  const normalized = normalizeSiteImages({
    homeHero: customHome,
    guidesHero: '',
    unknownImage: 'https://cdn.example/unknown.jpg',
  });

  assert.equal(normalized.homeHero, customHome);
  assert.equal(normalized.guidesHero, DEFAULT_SITE_IMAGES.guidesHero);
  assert.equal(normalized.unknownImage, undefined);
  assert.deepEqual(
    Object.keys(normalized),
    SITE_IMAGE_SLOTS.map(({ key }) => key),
  );
});