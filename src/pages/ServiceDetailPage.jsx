import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Briefcase, GraduationCap, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with real API calls or CMS content per service
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_DATA = {
  health: {
    icon: Heart,
    color: '#E63946',
    descKey: 'healthDesc',
    items: [
      { title: 'Medico di base', desc: 'Come iscriversi al medico curante in Italia', icon: '🏥' },
      { title: 'Pronto Soccorso', desc: 'Dove andare in caso di emergenza', icon: '🚑' },
      { title: 'Farmacia', desc: 'Come usare la tessera sanitaria', icon: '💊' },
      { title: 'Salute mentale', desc: 'Servizi di supporto psicologico', icon: '🧠' },
    ],
  },
  work: {
    icon: Briefcase,
    color: '#F4A261',
    descKey: 'workDesc',
    items: [
      { title: 'Contratto di lavoro', desc: 'Capire il tuo contratto Fincantieri', icon: '📋' },
      { title: 'Busta paga', desc: 'Come leggere la busta paga', icon: '💰' },
      { title: 'Ferie e permessi', desc: 'I tuoi diritti alle ferie', icon: '🌴' },
      { title: 'Sicurezza sul lavoro', desc: 'Norme di sicurezza in cantiere', icon: '⛑️' },
    ],
  },
  school: {
    icon: GraduationCap,
    color: '#2A9D8F',
    descKey: 'schoolDesc',
    items: [
      { title: 'Iscrizione scolastica', desc: 'Come iscrivere i figli a scuola', icon: '🏫' },
      { title: 'Asilo nido', desc: 'Trovare un asilo vicino a te', icon: '🍼' },
      { title: 'Corsi di italiano', desc: 'Imparare l\'italiano gratuitamente', icon: '🗣️' },
      { title: 'Sussidi scolastici', desc: 'Aiuti economici per le famiglie', icon: '📚' },
    ],
  },
  documents: {
    icon: FileText,
    color: '#457B9D',
    descKey: 'documentsDesc',
    items: [
      { title: 'Permesso di soggiorno', desc: 'Rinnovo e procedure', icon: '📄' },
      { title: 'Carta di identità', desc: 'Come richiedere la carta d\'identità', icon: '🪪' },
      { title: 'Codice fiscale', desc: 'Ottenere o rinnovare il codice fiscale', icon: '🔢' },
      { title: 'Ricongiungimento familiare', desc: 'Portare la famiglia in Italia', icon: '👨‍👩‍👧‍👦' },
    ],
  },
};

export default function ServiceDetailPage() {
  const { service } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const data = SERVICE_DATA[service];

  if (!data) return <div className="page-content"><p>Servizio non trovato</p></div>;

  const Icon = data.icon;

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: data.color }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon"><Icon size={40} color="#fff" /></div>
        <h2 className="page-hero-title">{t(service)}</h2>
        <p className="page-hero-sub">{t(data.descKey)}</p>
      </div>

      <div className="service-items">
        {data.items.map((item, i) => (
          <div key={i} className="service-detail-card">
            <span className="sdc-emoji">{item.icon}</span>
            <div>
              <p className="sdc-title">{item.title}</p>
              <p className="sdc-desc">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
