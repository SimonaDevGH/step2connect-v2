export const DEFAULT_SECTIONS = {
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

export function canSeeVisibility(visibility, user) {
  if (user?.type === 'admin') return true;
  const status = visibility ?? 'published';
  return status === 'published'
    || (status === 'preview' && user?.type === 'fincantieri_users');
}

export function canSeeSection(key, user, sections = DEFAULT_SECTIONS) {
  if (key === 'home') return true;
  const section = sections[key] ?? DEFAULT_SECTIONS[key];
  return !!section && canSeeVisibility(section.status, user);
}
