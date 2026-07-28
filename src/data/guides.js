import { FileText, Heart, Home, GraduationCap, Map, Briefcase } from 'lucide-react';

// ─── GUIDE CATEGORIES ─────────────────────────────────────────────────────────
// Each category has an id, icon, color, emoji, and ordered list of item ids.
// Set `empty: true` for categories with no items yet (show "coming soon" UI).
// ─────────────────────────────────────────────────────────────────────────────

export const GUIDE_CATEGORIES = [
  {
    id: 'documents',
    icon: FileText,
    color: '#457B9D',
    emoji: '📄',
    items: [
      'permitRequest',
      'permitRenewal',
      'idCardRequest',
      'idCardRenewal',
      'drivingLicenseRequest',
      'drivingLicenseRenewal',
    ],
  },
  {
    id: 'health',
    icon: Heart,
    color: '#E63946',
    emoji: '❤️',
    heroImage: '/guides-health.jpg',
    items: [
      'healthSystem',
      'emergency',
      'gpRegistration',
      'vaccinations',
      'bookVisit',
      'screening',
      'medicines',
    ],
  },
  {
    id: 'homeBills',
    icon: Home,
    color: '#F4A261',
    emoji: '🏠',
    items: ['findHome', 'condoRules', 'wasteTax', 'isee'],
  },
  {
    id: 'school',
    heroImage: '/guides-school.jpg',
    icon: GraduationCap,
    color: '#2A9D8F',
    emoji: '🎓',
    items: ['newbornGuide', 'raisingKids', 'schoolEnrollment'],
  },
  {
    id: 'cityLife',
    icon: Map,
    color: '#6A4C93',
    emoji: '🏙️',
    items: [
      'womensSupport',
      'libraryService',
      'publicTransport',
      'sport',
      'roadSafety',
      'mediator',
    ],
  },
  {
    id: 'work',
    icon: Briefcase,
    color: '#E9C46A',
    emoji: '💼',
    empty: true, // Coming soon — do not add items
    items: [],
  },
];

// ─── ITEM METADATA ────────────────────────────────────────────────────────────
// emoji: visual icon shown on list and detail pages
// i18n keys are derived automatically: guideItem{Id}Title / guideItem{Id}Desc
// ─────────────────────────────────────────────────────────────────────────────

export const GUIDE_ITEMS = {
  // Documents & Permits
  permitRequest:         { emoji: '📄' },
  permitRenewal:         { emoji: '🔄' },
  idCardRequest:         { emoji: '🪪' },
  idCardRenewal:         { emoji: '🪪' },
  drivingLicenseRequest: { emoji: '🚗' },
  drivingLicenseRenewal: { emoji: '🚗' },

  // Health & Emergency
  healthSystem:    { emoji: '🏥' },
  emergency:       { emoji: '🚑' },
  gpRegistration:  { emoji: '👨‍⚕️' },
  vaccinations:    { emoji: '💉' },
  bookVisit:       { emoji: '📅' },
  screening:       { emoji: '🔬' },
  medicines:       { emoji: '💊' },

  // Home & Bills
  findHome:    { emoji: '🏠' },
  condoRules:  { emoji: '🏢' },
  wasteTax:    { emoji: '♻️' },
  isee:        { emoji: '📊' },

  // School & Family
  newbornGuide:     { emoji: '👶' },
  raisingKids:      { emoji: '👨‍👩‍👧' },
  schoolEnrollment: { emoji: '🏫' },

  // City Life
  womensSupport:   { emoji: '🤲' },
  libraryService:  { emoji: '📚' },
  publicTransport: { emoji: '🚌' },
  sport:           { emoji: '⚽' },
  roadSafety:      { emoji: '🚦' },
  mediator:        { emoji: '🤝' },
};

// Helper: given a category id, return its config object
export function getCategoryById(id) {
  return GUIDE_CATEGORIES.find((c) => c.id === id) || null;
}
