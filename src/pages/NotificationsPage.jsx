import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with real push notification system (Firebase FCM, AWS SNS, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const NOTIFICATIONS = [
  { id: 1, emoji: '⚓', title: 'Turno di domani cambiato', body: 'Il tuo turno di domani inizia alle 06:00 invece delle 07:00.', time: '2 ore fa', read: false },
  { id: 2, emoji: '📄', title: 'Permesso in scadenza', body: 'Il tuo permesso di soggiorno scade tra 30 giorni. Rinnova subito.', time: 'Ieri', read: false },
  { id: 3, emoji: '💰', title: 'Busta paga disponibile', body: 'La busta paga di giugno è disponibile nel portale Fincantieri.', time: '3 giorni fa', read: true },
  { id: 4, emoji: '🏥', title: 'Visita medica programmata', body: 'Visita medica obbligatoria martedì 30 luglio ore 09:00.', time: '5 giorni fa', read: true },
];

export default function NotificationsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <div className="page-hero" style={{ background: '#E76F51' }}>
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ChevronLeft size={24} /> Home
        </button>
        <div className="page-hero-icon">🔔</div>
        <h2 className="page-hero-title">{t('notificationsTitle')}</h2>
      </div>

      <div className="notif-list">
        {NOTIFICATIONS.length === 0 && (
          <p className="empty-state">{t('noNotifications')}</p>
        )}
        {NOTIFICATIONS.map((n) => (
          <div key={n.id} className={`notif-card ${n.read ? 'read' : 'unread'}`}>
            <span className="notif-emoji">{n.emoji}</span>
            <div className="notif-body">
              <p className="notif-title">{n.title}</p>
              <p className="notif-text">{n.body}</p>
              <p className="notif-time">{n.time}</p>
            </div>
            {!n.read && <span className="notif-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
