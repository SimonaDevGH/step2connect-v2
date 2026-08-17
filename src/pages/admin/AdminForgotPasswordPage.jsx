import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';

const API = '';

export default function AdminForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Per sicurezza il backend risponde sempre 200 (non rivela se l'email esiste)
      await res.json().catch(() => ({}));
      setSent(true);
    } catch (err) {
      setError('Errore di rete. Riprova tra qualche istante.');
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

  return (
    <div style={outer}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1D3557', margin: 0 }}>
            Recupera password
          </h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
            Inserisci la tua email: riceverai un link per impostare una nuova password.
          </p>
        </div>

        {sent ? (
          <div style={{
            background: '#f0fff4', border: '1px solid #b7ebc8', borderRadius: 10,
            padding: '18px 16px', textAlign: 'center', color: '#1a6e35',
          }}>
            <Mail size={28} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Email inviata</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#2d6a4f' }}>
              Se l'indirizzo è registrato, riceverai a breve un'email con il link di reset.
              Il link è valido per 1 ora.
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

            <div style={{ marginBottom: 20 }}>
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
              {loading ? 'Invio in corso…' : 'Invia link di reset'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            to="/admin/login"
            style={{ color: '#1D3557', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </div>
      </div>
    </div>
  );
}
