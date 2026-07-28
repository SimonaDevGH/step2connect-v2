import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Hash, User, Mail, Building2, HardHat } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const LANGS = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'bn', label: 'বাং', flag: '🇧🇩' },
];

const COMPANIES = [
  'Fincantieri S.p.A.',
  'Altra azienda',
];

const SITES = [
  'Monfalcone (GO)',
  'Marghera – Venezia (VE)',
  'Castellammare di Stabia (NA)',
  'Genova Sestri Ponente (GE)',
  'Riva Trigoso – La Spezia (SP)',
  'Palermo (PA)',
  'Ancona (AN)',
  'Trieste (TS)',
];

export default function LoginPage() {
  const { t, lang, changeLang } = useLanguage();
  const { login, requestOTP } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState('form');  // 'form' | 'otp'

  // Shared
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register-only fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [site, setSite] = useState('');

  const resetForm = (newMode) => {
    setMode(newMode);
    setStep('form');
    setError('');
    setOtp('');
  };

  const isRegisterValid =
    firstName.trim() && lastName.trim() && phone.trim() && company && site;
  const isLoginValid = phone.trim();

  const handleSendOTP = async () => {
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
    const userData = mode === 'register'
      ? { firstName, lastName, email, company, site }
      : undefined;
    const result = await login(phone, otp, userData);
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
        <img src="/logo-white.png" alt="Step2Connect" className="login-logo-img" />
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
            onClick={() => resetForm('login')}
          >
            {t('loginTitle')}
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => resetForm('register')}
          >
            {t('registerTitle')}
          </button>
        </div>

        {step === 'form' ? (
          <>
            {mode === 'register' ? (
              <>
                {/* Nome */}
                <div className="input-group">
                  <User size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('firstNamePlaceholder')}
                    required
                  />
                </div>

                {/* Cognome */}
                <div className="input-group">
                  <User size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('lastNamePlaceholder')}
                    required
                  />
                </div>

                {/* Telefono */}
                <div className="input-group">
                  <Phone size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    inputMode="tel"
                    required
                  />
                </div>

                {/* Email (opzionale) */}
                <div className="input-group">
                  <Mail size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                  />
                </div>

                {/* Azienda */}
                <div className="input-group">
                  <Building2 size={18} className="input-icon" />
                  <select
                    className="text-input select-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  >
                    <option value="">{t('selectCompany')}</option>
                    {COMPANIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Cantiere */}
                <div className="input-group">
                  <HardHat size={18} className="input-icon" />
                  <select
                    className="text-input select-input"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    required
                  >
                    <option value="">{t('selectSite')}</option>
                    {SITES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleSendOTP}
                  disabled={loading || !isRegisterValid}
                >
                  {loading ? '...' : t('sendOtp')}
                </button>
              </>
            ) : (
              <>
                {/* Login: solo telefono */}
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
                  disabled={loading || !isLoginValid}
                >
                  {loading ? '...' : t('sendOtp')}
                </button>
              </>
            )}
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
            <button className="btn-ghost" onClick={() => setStep('form')}>← {t('back')}</button>
          </>
        )}
      </div>
    </div>
  );
}
