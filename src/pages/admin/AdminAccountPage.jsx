import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

const API = '';

export default function AdminAccountPage() {
  const { adminToken, adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      return setError('La nuova password deve contenere almeno 8 caratteri.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Le due password non coincidono.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { logout(); navigate('/admin/login', { replace: true }); return; }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSuccess('Password aggiornata con successo.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const card = {
    background: '#fff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    maxWidth: 420,
    width: '100%',
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#1D3557', marginBottom: 6,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', padding: 24 }}>
      {/* header */}
      <div style={{ maxWidth: 420, margin: '0 auto 20px' }}>
        <button
          onClick={() => navigate('/admin/content')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#1D3557', fontWeight: 600, fontSize: 14,
          }}
        >
          <ArrowLeft size={18} /> Torna alla gestione contenuti
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        {/* info utente */}
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#1D3557' }}>Il mio account</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#555' }}>
            <strong>{adminUser?.name}</strong><br />
            <span style={{ color: '#888' }}>{adminUser?.email}</span>
          </p>
        </div>

        {/* cambio password */}
        <div style={card}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#1D3557', display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} /> Modifica password
          </h3>

          {error && (
            <div style={{
              background: '#fff0f0', border: '1px solid #ffccc7', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, color: '#c0392b', fontSize: 14,
            }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: '#f0fff4', border: '1px solid #b7ebc8', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, color: '#1a6e35', fontSize: 14,
            }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password attuale</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nuova password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Conferma nuova password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                background: loading ? '#999' : '#1D3557', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Salvataggio…' : 'Aggiorna password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
