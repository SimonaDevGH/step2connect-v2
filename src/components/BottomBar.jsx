import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, UserCircle, LogOut, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function BottomBar() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userOpen, setUserOpen] = useState(false);

  const handleLogout = async () => {
    setUserOpen(false);
    await logout();
  };

  return (
    <>
      {/* User panel */}
      {userOpen && (
        <div className="bottom-user-panel">
          <div className="user-panel-header">
            <div className="user-panel-avatar">
              <UserCircle size={32} />
            </div>
            <div className="user-panel-info">
              <span className="user-panel-name">{user?.name || user?.phone}</span>
              {user?.site && <span className="user-panel-site">{user.site}</span>}
            </div>
            <button className="user-panel-close" onClick={() => setUserOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <button className="user-panel-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>{t('logout') || 'Esci'}</span>
          </button>
        </div>
      )}

      <nav className="bottom-bar">
        {/* Left: User */}
        <button
          className={`bottom-btn ${userOpen ? 'active' : ''}`}
          onClick={() => setUserOpen((v) => !v)}
          aria-label="Account"
        >
          <UserCircle size={24} />
          <span>{user?.firstName || 'Account'}</span>
        </button>

        {/* Center: Home */}
        <button
          className={`bottom-btn bottom-btn-home ${location.pathname === '/home' ? 'active' : ''}`}
          onClick={() => navigate('/home')}
          aria-label={t('home')}
        >
          <Home size={28} />
        </button>

        {/* Right: empty placeholder */}
        <div style={{ width: 56 }} />
      </nav>
    </>
  );
}
