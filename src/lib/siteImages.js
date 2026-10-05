export const SITE_IMAGES_ID = 'app-images';

export const SITE_IMAGE_GROUPS = [
  { key: 'home', label: 'Home' },
  { key: 'guides', label: 'Guide pratiche' },
  { key: 'guidesDocuments', label: 'Documenti e permessi' },
  { key: 'guidesHealth', label: 'Salute' },
  { key: 'guidesHomeBills', label: 'Casa e bollette' },
  { key: 'guidesSchool', label: 'Scuola e famiglia' },
  { key: 'guidesCityLife', label: 'Vita in città' },
  { key: 'guidesWork', label: 'Lavoro' },
  { key: 'analyze', label: 'Analizza documento' },
  { key: 'logos', label: 'Loghi' },
];

export const SITE_IMAGE_SLOTS = [
  { key: 'homeHero', group: 'home', label: 'Immagine principale', fallback: '/hero-venezia.jpg' },
  { key: 'guidesHero', group: 'guides', label: 'Immagine principale', fallback: '/guides-hero.png' },
  { key: 'guidesDocuments', group: 'guidesDocuments', label: 'Immagine principale', fallback: '/guides-documents.jpg' },
  { key: 'guidesHealth', group: 'guidesHealth', label: 'Immagine principale', fallback: '/guides-health.jpg' },
  { key: 'guidesHomeBills', group: 'guidesHomeBills', label: 'Immagine principale', fallback: '/guides-homeBills.jpg' },
  { key: 'guidesSchool', group: 'guidesSchool', label: 'Immagine principale', fallback: '/guides-school.jpg' },
  { key: 'guidesCityLife', group: 'guidesCityLife', label: 'Immagine principale', fallback: '/guides-cityLife.jpg' },
  { key: 'guidesWork', group: 'guidesWork', label: 'Immagine principale', fallback: '/guides-work.jpg' },
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