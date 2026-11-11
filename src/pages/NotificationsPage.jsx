import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { notificationDate, splitNotificationMessage } from '../lib/notificationDisplay';


export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { items, unread, loading, error, markRead, markAllRead, reload } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const openNotification = async (item) => {
    setBusy(true);
    setSaveError(false);
    const external = item.link.startsWith('https://');
    const tab = external ? window.open('about:blank', '_blank') : null;
    if (tab) tab.opener = null;
    try {
      await markRead([item.id]);
      if (external) {
        if (tab) tab.location.href = item.link;
        else throw new Error('Popup blocked');
      } else navigate(item.link);
    } catch {
      tab?.close();
      setSaveError(true);
    } finally { setBusy(false); }
  };

  const readAll = async () => {
    setBusy(true);
    setSaveError(false);
    try { await markAllRead(); } catch { setSaveError(true); }
    finally { setBusy(false); }
  };

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
        <div className="notif-actions">
          <button type="button" className="notif-read-all" onClick={readAll} disabled={busy || !unread}>
            {t('markAllNotificationsRead')}
          </button>
        </div>
        {(error || saveError) && <p role="alert" className="notif-error">
          {t('notificationsError')}{' '}
          <button type="button" onClick={() => reload().catch(() => {})}>{t('notificationsRetry')}</button>
        </p>}
        {loading && <p role="status">{t('notificationsLoading')}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="empty-state">{t('noNotifications')}</p>
        )}
        {items.map((item) => {
          const { emoji, text } = splitNotificationMessage(item.message);
          return (
            <button type="button" disabled={busy} key={item.id}
              className={`notif-card ${item.read ? 'read' : 'unread'}`}
              onClick={() => openNotification(item)}>
              {emoji && <span className="notif-emoji" aria-hidden="true">{emoji}</span>}
              <span className="notif-body">
                <span className="notif-text">{text}</span>
                <span className="notif-time">{notificationDate(item.startDate, t, lang)}</span>
              </span>
              {!item.read && <span className="notif-dot" aria-label={t('notificationUnread')} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
