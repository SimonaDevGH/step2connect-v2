import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

// Le route admin usano sempre URL relativi: in dev passa per il proxy Vite → Express 3001,
// in prod Express serve tutto sullo stesso origin. Non usare VITE_API_BASE_URL che punta
// all'API Gateway legacy che non ha le route /api/admin/auth/*.
const API = '';

export default function AdminLoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAdminAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      login(data.token, { email: data.email, name: data.name });
      navigate('/admin/content', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A1E3A',
      padding: 16,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 36,
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚙️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1D3557', margin: 0 }}>
            Admin CMS
          </h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
            Accesso riservato alla gestione contenuti
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: '#fff0f0', border: '1px solid #ffccc7',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: '#c0392b', fontSize: 14,
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1D3557', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1D3557', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: loading ? '#999' : '#1D3557', color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 16,
            }}
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link
              to="/admin/forgot-password"
              style={{ color: '#1D3557', fontSize: 13, textDecoration: 'none', opacity: 0.7 }}
            >
              Recupera password
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
