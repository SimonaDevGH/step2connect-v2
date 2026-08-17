/**
 * Script di migrazione una-tantum.
 * Carica su S3 i contenuti hard-coded come "published" iniziali.
 *
 * Uso:
 *   node scripts/migrate-to-s3.mjs
 *
 * Richiede le variabili d'ambiente:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;
if (!BUCKET) { console.error('S3_BUCKET_NAME non impostato'); process.exit(1); }

async function upload(key, obj) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(obj, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`  ✓ ${key}`);
}

const NOW = new Date().toISOString();
const AUTHOR = 'migration-script';

// ─── GUIDE CATEGORIES (metadati) ──────────────────────────────────────────────
const GUIDE_CATEGORIES = [
  { id: 'documents', emoji: '📄', category: 'documents' },
  { id: 'health',    emoji: '❤️', category: 'health' },
  { id: 'homeBills', emoji: '🏠', category: 'homeBills' },
  { id: 'school',    emoji: '🎓', category: 'school' },
  { id: 'cityLife',  emoji: '🏙️', category: 'cityLife' },
  { id: 'work',      emoji: '💼', category: 'work' },
];

// ─── GUIDE ITEMS con testo placeholder (da riempire dall'admin) ────────────────
const GUIDE_ITEMS = [
  // Documents
  { id: 'permitRequest',         category: 'documents', emoji: '📄', it: 'Richiesta permesso',          en: 'Permit request',           bn: 'পারমিট আবেদন' },
  { id: 'permitRenewal',         category: 'documents', emoji: '🔄', it: 'Rinnovo permesso',            en: 'Permit renewal',           bn: 'পারমিট নবায়ন' },
  { id: 'idCardRequest',         category: 'documents', emoji: '🪪', it: 'Richiesta carta d\'identità', en: 'ID card request',          bn: 'পরিচয়পত্র আবেদন' },
  { id: 'idCardRenewal',         category: 'documents', emoji: '🪪', it: 'Rinnovo carta d\'identità',   en: 'ID card renewal',          bn: 'পরিচয়পত্র নবায়ন' },
  { id: 'drivingLicenseRequest', category: 'documents', emoji: '🚗', it: 'Richiesta patente',           en: 'Driving license request',  bn: 'ড্রাইভিং লাইসেন্স আবেদন' },
  { id: 'drivingLicenseRenewal', category: 'documents', emoji: '🚗', it: 'Rinnovo patente',             en: 'Driving license renewal',  bn: 'ড্রাইভিং লাইসেন্স নবায়ন' },
  // Health
  { id: 'healthSystem',    category: 'health', emoji: '🏥', it: 'Il sistema sanitario',        en: 'The healthcare system',      bn: 'স্বাস্থ্যসেবা সিস্টেম' },
  { id: 'emergency',       category: 'health', emoji: '🚑', it: 'Emergenza',                   en: 'Emergency',                  bn: 'জরুরি সেবা' },
  { id: 'gpRegistration',  category: 'health', emoji: '👨‍⚕️', it: 'Medico di base',           en: 'GP registration',            bn: 'জিপি নিবন্ধন' },
  { id: 'vaccinations',    category: 'health', emoji: '💉', it: 'Vaccinazioni',                en: 'Vaccinations',               bn: 'টিকাদান' },
  { id: 'bookVisit',       category: 'health', emoji: '📅', it: 'Prenotare una visita',        en: 'Book a medical visit',       bn: 'চিকিৎসা পরিদর্শন বুক' },
  { id: 'screening',       category: 'health', emoji: '🔬', it: 'Screening',                   en: 'Screening',                  bn: 'স্ক্রিনিং' },
  { id: 'medicines',       category: 'health', emoji: '💊', it: 'Farmaci',                     en: 'Medicines',                  bn: 'ওষুধ' },
  // Home
  { id: 'findHome',   category: 'homeBills', emoji: '🏠', it: 'Trovare casa',  en: 'Finding a home',  bn: 'বাড়ি খোঁজা' },
  { id: 'condoRules', category: 'homeBills', emoji: '🏢', it: 'Regole condominio', en: 'Condo rules', bn: 'কনডো বিধি' },
  { id: 'wasteTax',   category: 'homeBills', emoji: '♻️', it: 'TARI — Tassa rifiuti', en: 'Waste tax', bn: 'বর্জ্য কর' },
  { id: 'isee',       category: 'homeBills', emoji: '📊', it: 'ISEE',          en: 'ISEE (income certificate)', bn: 'ISEE' },
  // School
  { id: 'newbornGuide',      category: 'school', emoji: '👶',    it: 'Guida neonato',        en: 'Newborn guide',        bn: 'নবজাতক গাইড' },
  { id: 'raisingKids',       category: 'school', emoji: '👨‍👩‍👧', it: 'Crescere i figli',  en: 'Raising kids in Italy', bn: 'শিশু লালন-পালন' },
  { id: 'schoolEnrollment',  category: 'school', emoji: '🏫',    it: 'Iscrizione scolastica', en: 'School enrolment',    bn: 'স্কুলে ভর্তি' },
  // City Life
  { id: 'womensSupport',   category: 'cityLife', emoji: '🤲', it: 'Supporto donne',      en: 'Women\'s support',   bn: 'নারী সহায়তা' },
  { id: 'libraryService',  category: 'cityLife', emoji: '📚', it: 'Biblioteca',           en: 'Library service',   bn: 'লাইব্রেরি সেবা' },
  { id: 'publicTransport', category: 'cityLife', emoji: '🚌', it: 'Trasporto pubblico',   en: 'Public transport',  bn: 'সার্বজনীন পরিবহন' },
  { id: 'sport',           category: 'cityLife', emoji: '⚽', it: 'Sport',                en: 'Sport',             bn: 'খেলাধুলা' },
  { id: 'roadSafety',      category: 'cityLife', emoji: '🚦', it: 'Sicurezza stradale',   en: 'Road safety',       bn: 'সড়ক নিরাপত্তা' },
  { id: 'mediator',        category: 'cityLife', emoji: '🤝', it: 'Mediatore culturale',  en: 'Cultural mediator', bn: 'সাংস্কৃতিক মধ্যস্থতাকারী' },
];

// ─── NEWS ──────────────────────────────────────────────────────────────────────
const NEWS = [
  { id: 'news-001', emoji: '⚓', it: { title: 'Nuove turnazioni cantiere luglio', body: 'Fincantieri ha aggiornato le turnazioni per il mese di luglio. Consulta il tabellone in cantiere.' }, en: { title: 'New shipyard shifts July', body: 'Fincantieri has updated shifts for July. Check the board at the shipyard.' }, bn: { title: 'জুলাই মাসের নতুন শিফট', body: 'ফিনক্যান্টিয়েরি জুলাই মাসের শিফট আপডেট করেছে।' } },
  { id: 'news-002', emoji: '🏥', it: { title: 'Vaccinazione influenzale: prenotazioni aperte', body: 'Dal 15 luglio è possibile prenotare la vaccinazione antinfluenzale presso il medico di base.' }, en: { title: 'Flu vaccination: bookings open', body: 'From 15 July you can book flu vaccination at your GP.' }, bn: { title: 'ফ্লু টিকা: বুকিং খোলা', body: '১৫ জুলাই থেকে ফ্লু টিকা বুক করতে পারবেন।' } },
  { id: 'news-003', emoji: '📄', it: { title: 'Rinnovo permessi: nuova procedura online', body: 'La questura di Venezia ha attivato il nuovo portale per il rinnovo del permesso di soggiorno.' }, en: { title: 'Permit renewal: new online procedure', body: 'The Venice police headquarters has activated a new portal for residence permit renewal.' }, bn: { title: 'পারমিট নবায়ন: নতুন অনলাইন পদ্ধতি', body: 'ভেনিস পুলিশ হেডকোয়ার্টার্স নতুন পোর্টাল চালু করেছে।' } },
  { id: 'news-004', emoji: '🎓', it: { title: 'Corsi di italiano gratuiti — iscrizioni aperte', body: 'Il CPIA di Venezia apre le iscrizioni per i corsi serali di italiano per stranieri.' }, en: { title: 'Free Italian courses — enrolments open', body: 'CPIA Venice opens enrolments for evening Italian courses for foreigners.' }, bn: { title: 'বিনামূল্যে ইতালিয়ান কোর্স', body: 'ভেনিসের CPIA বিদেশিদের জন্য সন্ধ্যাকালীন কোর্সে ভর্তি শুরু করেছে।' } },
];

// ─── LIBRARY ───────────────────────────────────────────────────────────────────
const LIBRARY = [
  { id: 'lib-001', category: 'documents', emoji: '📄', it: { title: 'Guida al permesso di soggiorno', body: '' }, en: { title: 'Residence permit guide', body: '' }, bn: { title: 'বাসস্থান পারমিট গাইড', body: '' } },
  { id: 'lib-002', category: 'work',      emoji: '💰', it: { title: 'Come leggere la busta paga', body: '' }, en: { title: 'How to read your payslip', body: '' }, bn: { title: 'বেতন স্লিপ কিভাবে পড়বেন', body: '' } },
  { id: 'lib-003', category: 'health',    emoji: '🏥', it: { title: 'Guida al sistema sanitario', body: '' }, en: { title: 'Healthcare system guide', body: '' }, bn: { title: 'স্বাস্থ্যসেবা সিস্টেম গাইড', body: '' } },
  { id: 'lib-004', category: 'school',    emoji: '🏫', it: { title: 'Iscrizione scolastica — guida', body: '' }, en: { title: 'School enrolment guide', body: '' }, bn: { title: 'স্কুলে ভর্তির গাইড', body: '' } },
  { id: 'lib-005', category: 'language',  emoji: '🗣️', it: { title: 'Frasi utili in italiano', body: '' }, en: { title: 'Useful Italian phrases', body: '' }, bn: { title: 'দরকারী ইতালিয়ান বাক্যাংশ', body: '' } },
  { id: 'lib-006', category: 'work',      emoji: '⚓', it: { title: 'Norme di sicurezza Fincantieri', body: '' }, en: { title: 'Fincantieri safety rules', body: '' }, bn: { title: 'ফিনক্যান্টিয়েরি নিরাপত্তা বিধি', body: '' } },
];

async function migrate() {
  console.log(`\n🚀 Migrazione verso bucket: ${BUCKET}\n`);

  // Guide items
  console.log('📖 Guide items…');
  for (const item of GUIDE_ITEMS) {
    for (const lang of ['it', 'en', 'bn']) {
      const obj = {
        id: item.id, type: 'guides', lang, category: item.category, emoji: item.emoji,
        title: item[lang] || item.it,
        body: `<!-- Contenuto da completare nell'area admin -->`,
        audioUrl: '', imageUrl: '',
        updatedBy: AUTHOR, updatedAt: NOW,
      };
      await upload(`content/published/guides/${lang}/${item.id}.json`, obj);
      await upload(`content/draft/guides/${lang}/${item.id}.json`,     obj);
    }
  }

  // News
  console.log('\n📰 News…');
  for (const item of NEWS) {
    for (const lang of ['it', 'en', 'bn']) {
      const obj = {
        id: item.id, type: 'news', lang, category: 'news', emoji: item.emoji,
        title: item[lang].title, body: item[lang].body,
        audioUrl: '', imageUrl: '',
        updatedBy: AUTHOR, updatedAt: NOW,
      };
      await upload(`content/published/news/${lang}/${item.id}.json`, obj);
      await upload(`content/draft/news/${lang}/${item.id}.json`,     obj);
    }
  }

  // Library
  console.log('\n📚 Libreria…');
  for (const item of LIBRARY) {
    for (const lang of ['it', 'en', 'bn']) {
      const obj = {
        id: item.id, type: 'library', lang, category: item.category, emoji: item.emoji,
        title: item[lang].title, body: item[lang].body,
        audioUrl: '', imageUrl: '',
        updatedBy: AUTHOR, updatedAt: NOW,
      };
      await upload(`content/published/library/${lang}/${item.id}.json`, obj);
      await upload(`content/draft/library/${lang}/${item.id}.json`,     obj);
    }
  }

  console.log('\n✅ Migrazione completata.\n');
}

migrate().catch((err) => { console.error(err); process.exit(1); });
