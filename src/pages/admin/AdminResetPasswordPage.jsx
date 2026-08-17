import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const API = '';

export default function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      return setError('La password deve contenere almeno 8 caratteri.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Le due password non coincidono.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDone(true);
      setTimeout(() => navigate('/admin/login', { replace: true }), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const outer = {
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0A1E3A', padding: 16,
  };
  const card = {
    background: '#fff', borderRadius: 16, padding: 36,
    width: '100%', maxWidth: 380,
    boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box',
  };

  if (!token) {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ textAlign: 'center', color: '#c0392b' }}>
            <p>Link non valido o mancante.</p>
            <Link to="/admin/login" style={{ color: '#1D3557', fontSize: 13 }}>
              ← Torna al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={outer}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1D3557', margin: 0 }}>
            Nuova password
          </h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
            Scegli una nuova password per il tuo account admin.
          </p>
        </div>

        {done ? (
          <div style={{
            background: '#f0fff4', border: '1px solid #b7ebc8', borderRadius: 10,
            padding: '18px 16px', textAlign: 'center', color: '#1a6e35',
          }}>
            <p style={{ margin: 0, fontWeight: 600 }}>✓ Password aggiornata</p>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Verrai reindirizzato al login tra pochi secondi…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: '#fff0f0', border: '1px solid #ffccc7', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, color: '#c0392b', fontSize: 14,
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1D3557', marginBottom: 6 }}>
                Nuova password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                minLength={8}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1D3557', marginBottom: 6 }}>
                Conferma nuova password
              </label>
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
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: loading ? '#999' : '#1D3557', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 16,
              }}
            >
              {loading ? 'Salvataggio…' : 'Salva nuova password'}
            </button>
          </form>
        )}

        {!done && (
          <div style={{ textAlign: 'center' }}>
            <Link
              to="/admin/login"
              style={{ color: '#1D3557', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeft size={14} /> Torna al login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
