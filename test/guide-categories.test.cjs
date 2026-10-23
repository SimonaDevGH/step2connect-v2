const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('guide categories contain exactly the five supported categories, never the removed work category', async () => {
  const { GUIDE_CATEGORIES, getCategoryById } = await import('../src/data/guides.js');
  assert.deepEqual(GUIDE_CATEGORIES.map(({ id }) => id), [
    'documents', 'health', 'homeBills', 'school', 'cityLife',
  ]);
  assert.equal(getCategoryById('work'), null);
  for (const category of GUIDE_CATEGORIES) {
    assert.equal(getCategoryById(category.id), category);
  }
});

test('CMS no longer offers the removed guide category or its image settings', async () => {
  const { SITE_IMAGE_GROUPS, SITE_IMAGE_SLOTS, normalizeSiteImages } = await import('../src/lib/siteImages.js');
  assert.equal(SITE_IMAGE_GROUPS.some(({ key }) => key === 'guidesWork'), false);
  assert.equal(SITE_IMAGE_SLOTS.some(({ key }) => key === 'guidesWork'), false);
  assert.equal(normalizeSiteImages({ guidesWork: 'https://example.invalid/old.jpg' }).guidesWork, undefined);
  const editor = fs.readFileSync('src/pages/admin/ContentEditForm.jsx', 'utf8');
  assert.doesNotMatch(editor, /value:\s*['"]work['"]/);
});
