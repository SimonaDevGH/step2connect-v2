import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with real API (e.g. Google Places, OpenStreetMap) filtered by Veneto
// ─────────────────────────────────────────────────────────────────────────────
const OFFICES = [
  { name: 'Ospedale di Venezia — SS. Giovanni e Paolo', type: 'hospital', city: 'Venezia', address: 'Castello 6777', phone: '+39 041 5294111' },
  { name: 'Ospedale di Mestre', type: 'hospital', city: 'Venezia Mestre', address: 'Via Circonvallazione 50', phone: '+39 041 2607111' },
  { name: 'Ospedale di Chioggia', type: 'hospital', city: 'Chioggia', address: 'Via Pollaio 1', phone: '+39 041 5534111' },
  { name: 'Patronato ACLI Venezia', type: 'patronato', city: 'Venezia', address: 'Cannaregio 1948', phone: '+39 041 5285511' },
  { name: 'Patronato INCA Mestre', type: 'patronato', city: 'Venezia Mestre', address: 'Via Piave 22', phone: '+39 041 9384562' },
  { name: 'Patronato CAF Chioggia', type: 'patronato', city: 'Chioggia', address: 'Corso del Popolo 112', phone: '+39 041 401234' },
  { name: 'Comune di Venezia', type: 'municipality', city: 'Venezia', address: 'San Marco 4091', phone: '+39 041 2748111' },
  { name: 'Comune di Chioggia', type: 'municipality', city: 'Chioggia', address: 'Corso del Popolo 1224', phone: '+39 041 5534111' },
  { name: 'Questura di Venezia', type: 'police', city: 'Venezia', address: 'Fondamenta di San Lorenzo, Castello 5056', phone: '+39 041 2715511' },
  { name: 'Sportello Immigrazione Venezia', type: 'police', city: 'Venezia Mestre', address: 'Via Dante 8', phone: '+39 041 2715600' },
];

const TYPE_ICONS = {
  hospital: '🏥',
  patronato: '🤝',
  municipality: '🏛️',
  police: '🚔',
};

const TYPE_COLORS = {
  hospital: '#E63946',
  patronato: '#2A9D8F',
  municipality: '#457B9D',
  police: '#1D3557',
};

export default function FindOfficesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const types = ['all', 'hospital', 'patronato', 'municipality', 'police'];

  const filtered = OFFICES.filter((o) => {
    const matchType = filter === 'all' || o.type === filter;
    const q = query.toLowerCase();
    const matchQuery = !q || o.name.toLowerCase().includes(q) || o.city.toLowerCase().includes(q) || o.address.toLowerCase().includes(q);
    return matchType && matchQuery;
  });

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#6A4C93' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon"><MapPin size={40} color="#fff" /></div>
        <h2 className="page-hero-title">{t('findOfficesTitle')}</h2>
      </div>

      <div className="offices-filters">
        <div className="search-wrap">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="type-pills">
          {types.map((type) => (
            <button
              key={type}
              className={`type-pill ${filter === type ? 'active' : ''}`}
              onClick={() => setFilter(type)}
              style={filter === type && type !== 'all' ? { background: TYPE_COLORS[type], color: '#fff', borderColor: TYPE_COLORS[type] } : {}}
            >
              {type !== 'all' && TYPE_ICONS[type]} {t(type)}
            </button>
          ))}
        </div>
      </div>

      <div className="offices-list">
        {filtered.map((office, i) => (
          <div key={i} className="office-card" style={{ '--type-color': TYPE_COLORS[office.type] || '#0A1E3A' }}>
            <span className="office-emoji">{TYPE_ICONS[office.type]}</span>
            <div className="office-info">
              <p className="office-name">{office.name}</p>
              <p className="office-city">📍 {office.city}</p>
              <p className="office-address">{office.address}</p>
              <a className="office-phone" href={`tel:${office.phone}`}>{office.phone}</a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="empty-state">Nessun risultato trovato</p>
        )}
      </div>
    </div>
  );
}
