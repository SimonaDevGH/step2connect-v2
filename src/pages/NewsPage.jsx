import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── FALLBACK (static data shown if API is unavailable) ──────────────────────
const NEWS_FALLBACK = [
  {
    id: 1,
    date: '2026-07-20',
    emoji: '⚓',
    title: { it: 'Nuove turnazioni cantiere luglio', en: 'New shipyard shifts July', bn: 'জুলাই মাসের নতুন শিফট' },
    body: { it: 'Fincantieri ha aggiornato le turnazioni per il mese di luglio. Consulta il tabellone in cantiere.', en: 'Fincantieri has updated shifts for July. Check the board at the shipyard.', bn: 'ফিনক্যান্টিয়েরি জুলাই মাসের শিফট আপডেট করেছে। শিপইয়ার্ডের বোর্ড দেখুন।' },
  },
  {
    id: 2,
    date: '2026-07-15',
    emoji: '🏥',
    title: { it: 'Vaccinazione influenzale: prenotazioni aperte', en: 'Flu vaccination: bookings open', bn: 'ফ্লু টিকা: বুকিং খোলা' },
    body: { it: 'Dal 15 luglio è possibile prenotare la vaccinazione antinfluenzale presso il medico di base.', en: 'From 15 July you can book flu vaccination at your GP.', bn: '১৫ জুলাই থেকে আপনার জিপিতে ফ্লু টিকা বুক করতে পারবেন।' },
  },
  {
    id: 3,
    date: '2026-07-10',
    emoji: '📄',
    title: { it: 'Rinnovo permessi: nuova procedura online', en: 'Permit renewal: new online procedure', bn: 'পারমিট নবায়ন: নতুন অনলাইন পদ্ধতি' },
    body: { it: 'La questura di Venezia ha attivato il nuovo portale per il rinnovo del permesso di soggiorno.', en: 'The Venice police headquarters has activated a new portal for residence permit renewal.', bn: 'ভেনিস পুলিশ হেডকোয়ার্টার্স বাসস্থান পারমিট নবায়নের জন্য নতুন পোর্টাল চালু করেছে।' },
  },
  {
    id: 4,
    date: '2026-07-05',
    emoji: '🎓',
    title: { it: 'Corsi di italiano gratuiti — iscrizioni aperte', en: 'Free Italian courses — enrolments open', bn: 'বিনামূল্যে ইতালিয়ান কোর্স — ভর্তি চলছে' },
    body: { it: 'Il CPIA di Venezia apre le iscrizioni per i corsi serali di italiano per stranieri.', en: 'CPIA Venice opens enrolments for evening Italian courses for foreigners.', bn: 'ভেনিসের CPIA বিদেশিদের জন্য সন্ধ্যাকালীন ইতালিয়ান কোর্সে ভর্তি শুরু করেছে।' },
  },
];

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function NewsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [news, setNews] = useState(NEWS_FALLBACK);

  useEffect(() => {
    fetch(`${API}/api/content?type=news&lang=${lang}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setNews(data);
      })
      .catch(() => {
        // API unavailable — keep fallback data
      });
  }, [lang]);

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#1D3557' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">📰</div>
        <h2 className="page-hero-title">{t('newsTitle')}</h2>
      </div>

      <div className="news-list">
        {news.map((item) => (
          <div key={item.id} className="news-card">
            <span className="news-emoji">{item.emoji}</span>
            <div className="news-content">
              <p className="news-date">{item.date || item.updatedAt?.split('T')[0] || ''}</p>
              <p className="news-title">
                {typeof item.title === 'string' ? item.title : (item.title?.[lang] ?? item.title?.it)}
              </p>
              <p className="news-body">
                {typeof item.body === 'string' ? item.body : (item.body?.[lang] ?? item.body?.it)}
              </p>
              <button className="news-read">{t('readMore')} →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
