const test = require('node:test');
const assert = require('node:assert/strict');

test('WhatsApp links use the real service number and the exact Italian bot keywords', async () => {
  const { WA_NUMBER, WA_ANALYZE_URL, WA_TRANSLATE_URL } = await import('../src/lib/whatsapp.js');
  assert.equal(WA_NUMBER, '393490645720');
  assert.equal(WA_ANALYZE_URL, 'https://wa.me/393490645720?text=analizza%20documento');
  assert.equal(WA_TRANSLATE_URL, 'https://wa.me/393490645720?text=traduci');
});

test('Home and WhatsApp copy exists in all three languages without changing guide or library identifiers', async () => {
  const keys = [
    'seeAllGuides', 'waPageTitle', 'waPageSub', 'waAnalyzeTitle', 'waAnalyzeDesc',
    'waStepTap', 'waAnalyzeStep2', 'waAnalyzeStep3', 'waAnalyzeBtn',
    'waTranslateTitle', 'waTranslateDesc', 'waTranslateStep2', 'waTranslateStep3',
    'waTranslateBtn', 'analyzeTitle', 'translate',
  ];
  for (const [lang, games, guides] of [
    ['it', 'Games', 'Tutte le guide'],
    ['en', 'Games', 'All guides'],
    ['bn', 'গেমস', 'সব গাইড'],
  ]) {
    const { default: dictionary } = await import(`../src/i18n/${lang}.js`);
    for (const key of keys) assert.ok(dictionary[key]?.trim(), `${lang}: ${key}`);
    assert.equal(dictionary.botTitle, 'Ask Me');
    assert.equal(dictionary.quiz, games);
    assert.equal(dictionary.quizTitle, games);
    assert.equal(dictionary.guidesTitle, guides);
    assert.ok(dictionary.library && dictionary.libraryTitle);
  }
});
