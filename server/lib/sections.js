const { getJson, putJson } = require('./s3');

const SECTIONS_KEY = 'config/sections.json';
const VISIBILITIES = ['internal', 'preview', 'published'];
const DEFAULT_SECTIONS = {
  guides: { status: 'published' },
  'analyze-document': { status: 'published' },
  translator: { status: 'published' },
  privacy: { status: 'published' },
  quiz: { status: 'internal' },
  notifications: { status: 'internal' },
  news: { status: 'internal' },
  offices: { status: 'internal' },
  library: { status: 'internal' },
};
const defaults = () => Object.fromEntries(
  Object.entries(DEFAULT_SECTIONS).map(([key, value]) => [key, { ...value }]),
);

async function getSections() {
  let saved;
  try {
    saved = await getJson(SECTIONS_KEY);
  } catch (err) {
    if (err instanceof SyntaxError) return defaults();
    throw err;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults();
  if (Object.keys(DEFAULT_SECTIONS).some((key) =>
    saved[key] !== undefined && !VISIBILITIES.includes(saved[key]?.status)
  )) return defaults();
  return Object.fromEntries(Object.entries(DEFAULT_SECTIONS).map(([key, value]) => [
    key, { ...(saved[key] || value) },
  ]));
}

async function setSectionStatus(key, status, author) {
  if (!Object.hasOwn(DEFAULT_SECTIONS, key) || !VISIBILITIES.includes(status)) {
    const err = new Error('Invalid section or status');
    err.status = 400;
    throw err;
  }
  const sections = await getSections();
  sections[key] = { status, updatedAt: new Date().toISOString(), updatedBy: author };
  await putJson(SECTIONS_KEY, sections);
  return sections;
}

module.exports = { DEFAULT_SECTIONS, VISIBILITIES, getSections, setSectionStatus };
