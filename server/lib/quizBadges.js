const { getJson, putJson } = require('./s3');
const KEY = 'config/quiz-badges.json';
const DEFAULTS = [
  { id: 'documents', category: 'documents', emoji: '📄', title: { it: 'Esperto burocrate', en: 'Paperwork Pro', bn: 'কাগজপত্রের ওস্তাদ' } },
  { id: 'health', category: 'health', emoji: '🚑', title: { it: "Pronto all'emergenza", en: 'Emergency Ready', bn: 'জরুরি অবস্থায় প্রস্তুত' } },
  { id: 'homeBills', category: 'homeBills', emoji: '🏠', title: { it: 'Casa in regola', en: 'Home in Order', bn: 'ঘরের সব নিয়ম জানা' } },
  { id: 'school', category: 'school', emoji: '🎓', title: { it: 'Genitore a pieni voti', en: 'Straight-A Parent', bn: 'সেরা অভিভাবক' } },
  { id: 'cityLife', category: 'cityLife', emoji: '🏙️', title: { it: 'Di casa in città', en: 'City Insider', bn: 'শহরের চেনা মুখ' } },
  { id: 'champion', category: null, emoji: '🏆', title: { it: 'Campione Step2Connect', en: 'Step2Connect Champion', bn: 'Step2Connect চ্যাম্পিয়ন' } },
];
function validate(items) {
  const fail = () => { throw Object.assign(new Error('Specificare i sei badge con ID/categorie originali, emoji e titoli IT/EN/BN (massimo 120 caratteri).'), { status: 400 }); };
  if (!Array.isArray(items) || items.length !== DEFAULTS.length || new Set(items.map((b) => b?.id)).size !== DEFAULTS.length) fail();
  return DEFAULTS.map((base) => {
    const value = items.find((b) => b?.id === base.id);
    if (!value || value.category !== base.category || typeof value.emoji !== 'string'
      || !value.emoji.trim() || [...value.emoji.trim()].length > 24) fail();
    const title = {};
    for (const lang of ['it', 'en', 'bn']) {
      if (typeof value.title?.[lang] !== 'string' || !value.title[lang].trim() || value.title[lang].trim().length > 120) fail();
      title[lang] = value.title[lang].trim();
    }
    return { id: base.id, category: base.category, emoji: value.emoji.trim(), title };
  });
}
async function definitions() {
  const stored = await getJson(KEY);
  return stored === null ? structuredClone(DEFAULTS) : validate(stored);
}
async function saveDefinitions(items) {
  const clean = validate(items);
  await putJson(KEY, clean);
  return clean;
}
function states(defs, quizzes, results = {}, earned = {}) {
  const items = defs.map((def) => {
    const categoryQuizzes = def.category ? quizzes.filter((q) => q.category === def.category) : [];
    const passed = categoryQuizzes.filter((q) => results[q.id]?.passedAt).length;
    return { ...def, unlocked: Boolean(earned[def.id]), unlockedAt: earned[def.id] || null,
      passed, total: categoryQuizzes.length,
      eligible: categoryQuizzes.length > 0 && passed === categoryQuizzes.length };
  });
  const active = items.filter((b) => b.category && b.total > 0);
  const champion = items.find((b) => b.id === 'champion');
  champion.total = active.length;
  champion.passed = active.filter((b) => b.unlocked || b.eligible).length;
  champion.eligible = active.length > 0 && champion.passed === active.length;
  return items;
}
function response(defs, quizzes, results, earned) {
  const items = states(defs, quizzes, results, earned).map(({ eligible, ...badge }) => badge);
  return { items, earned: items.filter((b) => b.unlocked).length, total: items.length };
}
module.exports = { DEFAULTS, definitions, saveDefinitions, states, response };
