import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Hash, User, Mail, Building2, HardHat } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  checkPreviewAdmin,
  getPhoneAccountStatus,
  getRegistrationOptions,
  verifyPreviewAdmin,
} from '../lib/userApi.js';
import { beginPhoneLogin } from '../lib/loginFlow.js';
import { validatePhoneNumber } from '../lib/phoneValidation.js';

const LANGS = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'bn', label: 'বাং', flag: '🇧🇩' },
];

export default function LoginPage() {
  const { t, lang, changeLang } = useLanguage();
  const { login, requestOTP, loginPreviewSession } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState('form');  // 'form' | 'otp'

  // Shared
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [noticeKey, setNoticeKey] = useState('');

  // Register-only fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [site, setSite] = useState('');
  const [registrationOptions, setRegistrationOptions] = useState({ companies: [], sites: [] });
  const [registrationOptionsLoading, setRegistrationOptionsLoading] = useState(false);
  const [registrationOptionsFailed, setRegistrationOptionsFailed] = useState(false);
  const [registrationOptionsReload, setRegistrationOptionsReload] = useState(0);

  // Stato interno per passare dati tra step
  const [otpMeta, setOtpMeta] = useState({ phoneE164: '', isRegister: false, userData: {} });

  useEffect(() => {
    if (mode !== 'register') return undefined;

    let active = true;
    setRegistrationOptionsLoading(true);
    setRegistrationOptionsFailed(false);
    getRegistrationOptions()
      .then((options) => {
        if (!active) return;
        setRegistrationOptions(options);
        setCompany((current) => options.companies.includes(current) ? current : '');
        setSite((current) => options.sites.includes(current) ? current : '');
      })
      .catch(() => {
        if (active) setRegistrationOptionsFailed(true);
      })
      .finally(() => {
        if (active) setRegistrationOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, registrationOptionsReload]);

  const resetForm = (newMode) => {
    setMode(newMode);
    setStep('form');
    setError('');
    setPhoneError('');
    setNoticeKey('');
    setOtp('');
  };

  const isRegisterValid = firstName.trim() && lastName.trim() && phone.trim()
    && company && site && !registrationOptionsFailed && !registrationOptionsLoading;
  const isLoginValid = phone.trim();

  const handleSendOTP = async () => {
    if (!validatePhoneNumber(phone).valid) {
      setPhoneError(t('invalidPhoneNumber'));
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    setPhoneError('');

    const userData = mode === 'register'
      ? { firstName, lastName, email, company, site }
      : {};

    let flow;
    try {
      flow = await beginPhoneLogin({
        mode,
        phone,
        userData,
        getPhoneAccountStatus,
        checkPreviewAdmin,
        requestOTP,
      });
    } catch {
      flow = { kind: 'error' };
    }
    setLoading(false);

    if (flow.kind === 'switch-to-register') {
      setMode('register');
      setStep('form');
      setNoticeKey('accountNotRegistered');
      setOtp('');
      return;
    }

    if (flow.kind === 'switch-to-login') {
      setMode('login');
      setStep('form');
      setNoticeKey('accountAlreadyRegistered');
      setOtp('');
      return;
    }

    if (flow.kind === 'error') {
      setError(t('accountCheckError'));
      return;
    }

    if (flow.kind === 'admin-preview-code') {
      setOtpMeta({
        phoneE164: phone,
        isRegister: false,
        userData: {},
        isPreviewAdmin: true,
        previewChallenge: flow.challenge,
      });
      setStep('otp');
      return;
    }

    const { result } = flow;
    if (!result.success) {
      setError(result.error || 'Errore invio OTP');
      return;
    }

    setOtpMeta({
      phoneE164: result.phoneE164,
      isRegister: result.isRegister,
      userData,
    });
    setStep('otp');
  };

  const handleVerify = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setError('');

    if (otpMeta.isPreviewAdmin) {
      const previewSession = await verifyPreviewAdmin(
        phone,
        otp,
        otpMeta.previewChallenge,
      );
      if (!previewSession) {
        setLoading(false);
        setError('Codice preview non valido');
        return;
      }
      loginPreviewSession(previewSession);
      setLoading(false);
      navigate('/home');
      return;
    }

    const result = await login(
      otpMeta.phoneE164,
      otp,
      otpMeta.userData,
      otpMeta.isRegister,
    );

    setLoading(false);
    if (result.success) {
      navigate('/home');
    } else {
      setError(result.error || 'Errore');
    }
  };

  const handleRequestSmsOTP = async () => {
    setLoading(true);
    setError('');
    const result = await requestOTP(phone, {});
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Errore invio OTP');
      return;
    }
    setOtp('');
    setOtpMeta({
      phoneE164: result.phoneE164,
      isRegister: result.isRegister,
      userData: {},
      isPreviewAdmin: false,
    });
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
            {noticeKey && <p className="account-notice">{t(noticeKey)}</p>}
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
                <p className="login-phone-hint">{t('loginPhoneHint')}</p>
                <div className="input-group">
                  <Phone size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError('');
                    }}
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
                    <option value="">
                      {registrationOptions.companies.length
                        ? t('selectCompany')
                        : t(registrationOptionsLoading
                          ? 'registrationOptionsLoading'
                          : 'selectCompany')}
                    </option>
                    {registrationOptions.companies.map((c) => (
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
                    <option value="">
                      {registrationOptions.sites.length
                        ? t('selectSite')
                        : t(registrationOptionsLoading
                          ? 'registrationOptionsLoading'
                          : 'selectSite')}
                    </option>
                    {registrationOptions.sites.map((s) => (
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
                {registrationOptionsFailed && (
                  <>
                    <p className="error-text">{t('registrationOptionsError')}</p>
                    <button
                      className="btn-ghost"
                      onClick={() => setRegistrationOptionsReload((value) => value + 1)}
                      disabled={registrationOptionsLoading}
                    >
                      {t('retry')}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Login: solo telefono */}
                <p className="login-phone-hint">{t('loginPhoneHint')}</p>
                <div className="input-group">
                  <Phone size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError('');
                    }}
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
            {/* Errore invio OTP — visibile nello step form, non solo nell'OTP step */}
            {phoneError && <p className="error-text">{phoneError}</p>}
            {error && <p className="error-text">{error}</p>}
          </>
        ) : (
          <>
            <p className="otp-hint">
              {otpMeta.isPreviewAdmin ? t('accessCodePrompt') : t('otpSent')}:{' '}
              <strong>{otpMeta.phoneE164 || phone}</strong>
            </p>
            <div className="input-group">
              <Hash size={18} className="input-icon" />
              <input
                className="text-input otp-input"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t('otpPlaceholder')}
                inputMode="numeric"
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
            {!otpMeta.isRegister && (
              <>
                <p className="otp-resend-hint">{t('otpResendHint')}</p>
                <button
                  className="btn-ghost"
                  onClick={handleRequestSmsOTP}
                  disabled={loading}
                >
                  {t('sendSmsOtp')}
                </button>
              </>
            )}
            <button className="btn-ghost" onClick={() => setStep('form')}>← {t('back')}</button>
          </>
        )}
      </div>
    </div>
  );
}
