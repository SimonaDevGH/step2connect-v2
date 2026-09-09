export const SITE_IMAGES_ID = 'app-images';

export const SITE_IMAGE_GROUPS = [
  { key: 'home', label: 'Home' },
  { key: 'guides', label: 'Guide' },
  { key: 'analyze', label: 'Analizza documento' },
  { key: 'logos', label: 'Loghi' },
];

export const SITE_IMAGE_SLOTS = [
  { key: 'homeHero', group: 'home', label: 'Immagine principale', fallback: '/hero-venezia.jpg' },
  { key: 'guidesHero', group: 'guides', label: 'Immagine principale', fallback: '/guides-hero.png' },
  { key: 'guidesDocuments', group: 'guides', label: 'Documenti e permessi', fallback: '/guides-documents.jpg' },
  { key: 'guidesHealth', group: 'guides', label: 'Salute', fallback: '/guides-health.jpg' },
  { key: 'guidesHomeBills', group: 'guides', label: 'Casa e bollette', fallback: '/guides-homeBills.jpg' },
  { key: 'guidesSchool', group: 'guides', label: 'Scuola e famiglia', fallback: '/guides-school.jpg' },
  { key: 'guidesCityLife', group: 'guides', label: 'Vita in città', fallback: '/guides-cityLife.jpg' },
  { key: 'guidesWork', group: 'guides', label: 'Lavoro', fallback: '/guides-work.jpg' },
  { key: 'analyzeDocumentHero', group: 'analyze', label: 'Immagine principale', fallback: '/analyze-document.jpg' },
  { key: 'appLogo', group: 'logos', label: 'Step2Connect — login e barra superiore', fallback: '/logo-white.png' },
  { key: 'partnerLogo', group: 'logos', label: 'Fincantieri — menu laterale', fallback: '/logo-fincantieri-white.png' },
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