import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Hash, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const LANGS = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'bn', label: 'বাং', flag: '🇧🇩' },
];

export default function LoginPage() {
  const { t, lang, changeLang } = useLanguage();
  const { login, requestOTP } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    await requestOTP(phone);
    setLoading(false);
    setStep('otp');
  };

  const handleVerify = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    const result = await login(phone, otp, mode === 'register' ? name : undefined);
    setLoading(false);
    if (result.success) {
      navigate('/home');
    } else {
      setError(result.error || 'Errore');
    }
  };

  return (
    <div className="login-page">
      {/* Header */}
      <div className="login-header">
        <div className="login-logo">
          <div className="logo-circle">S2C</div>
        </div>
        <h1 className="login-app-name">{t('appName')}</h1>
        <p className="login-tagline">{t('tagline')}</p>

        {/* Language selector */}
        <div className="lang-selector">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang-pill ${lang === l.code ? 'active' : ''}`}
              onClick={() => changeLang(l.code)}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="login-card">
        {/* Mode tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setStep('phone'); setError(''); }}
          >
            {t('loginTitle')}
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setStep('phone'); setError(''); }}
          >
            {t('registerTitle')}
          </button>
        </div>

        {step === 'phone' ? (
          <>
            {mode === 'register' && (
              <div className="input-group">
                <User size={18} className="input-icon" />
                <input
                  className="text-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                />
              </div>
            )}
            <div className="input-group">
              <Phone size={18} className="input-icon" />
              <input
                className="text-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('phonePlaceholder')}
                inputMode="tel"
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleSendOTP}
              disabled={loading || !phone.trim()}
            >
              {loading ? '...' : t('sendOtp')}
            </button>
          </>
        ) : (
          <>
            <p className="otp-hint">{t('otpSent')}: <strong>{phone}</strong></p>
            <p className="otp-demo-hint">{t('otpHint')}</p>
            <div className="input-group">
              <Hash size={18} className="input-icon" />
              <input
                className="text-input otp-input"
                type="number"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t('otpPlaceholder')}
                inputMode="numeric"
                maxLength={6}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button
              className="btn-primary"
              onClick={handleVerify}
              disabled={loading || !otp.trim()}
            >
              {loading ? '...' : t('verifyOtp')}
            </button>
            <button className="btn-ghost" onClick={() => setStep('phone')}>← Indietro</button>
          </>
        )}
      </div>
    </div>
  );
}
