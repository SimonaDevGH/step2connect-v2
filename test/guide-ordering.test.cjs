const assert = require('node:assert/strict');
const test = require('node:test');

test('guide category ordering follows CMS numbers and keeps unnumbered items stable', async () => {
  const { orderGuideItems } = await import('../src/lib/guideOrdering.js');
  const ordered = orderGuideItems([
    { id: 'legacy-a', sortOrder: null },
    { id: 'third', sortOrder: 3 },
    { id: 'first', sortOrder: 1 },
    { id: 'legacy-b' },
    { id: 'also-third', sortOrder: 3 },
  ]);

  assert.deepEqual(
    ordered.map(({ id }) => id),
    ['first', 'third', 'also-third', 'legacy-a', 'legacy-b'],
  );
});

test('featured service guide is never listed inside an intermediate category', async () => {
  const {
    FEATURED_SERVICE_GUIDE_ID,
    belongsToGuideCategory,
  } = await import('../src/lib/guideOrdering.js');

  assert.equal(
    belongsToGuideCategory(
      { id: FEATURED_SERVICE_GUIDE_ID, category: 'documents' },
      'documents',
    ),
    false,
  );
  assert.equal(
    belongsToGuideCategory({ id: 'permitRequest', category: 'documents' }, 'documents'),
    true,
  );
});