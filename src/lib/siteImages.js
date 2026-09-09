export const SITE_IMAGES_ID = 'app-images';

export const SITE_IMAGE_SLOTS = [
  { key: 'homeHero', label: 'Home — immagine principale', fallback: '/hero-venezia.jpg' },
  { key: 'guidesHero', label: 'Guide — immagine principale', fallback: '/guides-hero.png' },
  { key: 'guidesDocuments', label: 'Guide — Documenti e permessi', fallback: '/guides-documents.jpg' },
  { key: 'guidesHealth', label: 'Guide — Salute', fallback: '/guides-health.jpg' },
  { key: 'guidesHomeBills', label: 'Guide — Casa e bollette', fallback: '/guides-homeBills.jpg' },
  { key: 'guidesSchool', label: 'Guide — Scuola e famiglia', fallback: '/guides-school.jpg' },
  { key: 'guidesCityLife', label: 'Guide — Vita in città', fallback: '/guides-cityLife.jpg' },
  { key: 'guidesWork', label: 'Guide — Lavoro', fallback: '/guides-work.jpg' },
  { key: 'analyzeDocumentHero', label: 'Analizza documento — immagine principale', fallback: '/analyze-document.jpg' },
  { key: 'appLogo', label: 'Logo Step2Connect — login e barra superiore', fallback: '/logo-white.png' },
  { key: 'partnerLogo', label: 'Logo Fincantieri — menu laterale', fallback: '/logo-fincantieri-white.png' },
];

export const DEFAULT_SITE_IMAGES = Object.fromEntries(
  SITE_IMAGE_SLOTS.map(({ key, fallback }) => [key, fallback]),
);

export function normalizeSiteImages(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    SITE_IMAGE_SLOTS.map(({ key, fallback }) => [
      key,
      typeof source[key] === 'string' && source[key].trim() ? source[key].trim() : fallback,
    ]),
  );
}