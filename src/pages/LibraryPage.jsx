import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with real document storage (S3, CMS, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const DOCUMENTS = [
  { emoji: '📄', title: { it: 'Guida al permesso di soggiorno', en: 'Residence permit guide', bn: 'বাসস্থান পারমিট গাইড' }, category: 'documents', size: '1.2 MB', url: '#' },
  { emoji: '💰', title: { it: 'Come leggere la busta paga', en: 'How to read your payslip', bn: 'বেতন স্লিপ কিভাবে পড়বেন' }, category: 'work', size: '800 KB', url: '#' },
  { emoji: '🏥', title: { it: 'Guida al sistema sanitario', en: 'Healthcare system guide', bn: 'স্বাস্থ্যসেবা সিস্টেম গাইড' }, category: 'health', size: '1.5 MB', url: '#' },
  { emoji: '🏫', title: { it: 'Iscrizione scolastica — guida', en: 'School enrolment guide', bn: 'স্কুলে ভর্তির গাইড' }, category: 'school', size: '900 KB', url: '#' },
  { emoji: '🗣️', title: { it: 'Frasi utili in italiano', en: 'Useful Italian phrases', bn: 'দরকারী ইতালিয়ান বাক্যাংশ' }, category: 'language', size: '500 KB', url: '#' },
  { emoji: '⚓', title: { it: 'Norme di sicurezza Fincantieri', en: 'Fincantieri safety rules', bn: 'ফিনক্যান্টিয়েরি নিরাপত্তা বিধি' }, category: 'work', size: '2.1 MB', url: '#' },
];

const CAT_COLORS = { documents: '#457B9D', work: '#F4A261', health: '#E63946', school: '#2A9D8F', language: '#118AB2' };

export default function LibraryPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#06A77D' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">📚</div>
        <h2 className="page-hero-title">{t('libraryTitle')}</h2>
      </div>

      <div className="library-list">
        {DOCUMENTS.map((doc, i) => (
          <div key={i} className="library-card" style={{ '--cat-color': CAT_COLORS[doc.category] }}>
            <span className="lib-emoji">{doc.emoji}</span>
            <div className="lib-info">
              <p className="lib-title">{doc.title[lang] || doc.title.it}</p>
              <p className="lib-size">{doc.size}</p>
            </div>
            <a className="lib-download" href={doc.url} download>
              <Download size={20} />
              <span>{t('download')}</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
