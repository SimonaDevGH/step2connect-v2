import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, Hash, User, Mail, Building2, HardHat } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSiteImages } from '../context/SiteImagesContext';
import {
  checkPreviewAdmin,
  getLegacyLink,
  lookupLegacyEmail,
  getPhoneAccountStatus,
  getRegistrationOptions,
  verifyPreviewAdmin,
} from '../lib/userApi.js';
import { beginPhoneLogin } from '../lib/loginFlow.js';
import { validatePhoneNumber } from '../lib/phoneValidation.js';
import { isValidEmail } from '../lib/emailValidation.js';

const LANGS = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'bn', label: 'বাং', flag: '🇧🇩' },
];

export default function LoginPage({ legacyRoute = false }) {
  const { t, lang, changeLang } = useLanguage();
  const { login, requestOTP, loginPreviewSession } = useAuth();
  const siteImages = useSiteImages();
  const navigate = useNavigate();
  const location = useLocation();
  const legacyReadStarted = useRef(false);
  const legacyLookupStarted = useRef('');
  const emailSentDialog = useRef(null);

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
  const [emailTouched, setEmailTouched] = useState(false);
  const [company, setCompany] = useState('');
  const [site, setSite] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [registrationOptions, setRegistrationOptions] = useState({ companies: [], sites: [] });
  const [registrationOptionsLoading, setRegistrationOptionsLoading] = useState(false);
  const [registrationOptionsLoaded, setRegistrationOptionsLoaded] = useState(false);
  const [registrationOptionsFailed, setRegistrationOptionsFailed] = useState(false);
  const [registrationOptionsReload, setRegistrationOptionsReload] = useState(0);
  const [legacyToken, setLegacyToken] = useState('');
  const [legacyProfile, setLegacyProfile] = useState(null);
  const [legacyState, setLegacyState] = useState('idle');
  const [legacyAccessNotice, setLegacyAccessNotice] = useState(false);
  const [legacyEmailSent, setLegacyEmailSent] = useState(false);

  // Stato interno per passare dati tra step
  const [otpMeta, setOtpMeta] = useState({ phoneE164: '', isRegister: false, userData: {} });

  useEffect(() => {
    if (!legacyRoute) {
      legacyReadStarted.current = false;
      legacyLookupStarted.current = '';
    }
    if (legacyRoute && !legacyReadStarted.current) {
      legacyReadStarted.current = true;
      const token = new URLSearchParams(window.location.search).get('t') || '';
      setLegacyToken(token);
      setLegacyState(token ? 'loading' : 'invalid');
      setPrivacyAccepted(false);
      setLegacyAccessNotice(false);
      // Email links are the only entry point. Keep their token in component memory.
      navigate(`${location.pathname}${location.hash}`, { replace: true, state: {} });
      return;
    }

    if (!legacyRoute && location.state?.legacyNotice) {
      setNoticeKey('legacyInvalidLinkNotice');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [legacyRoute, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (legacyEmailSent && !emailSentDialog.current?.open) emailSentDialog.current?.showModal();
  }, [legacyEmailSent]);

  useEffect(() => {
    if (legacyRoute && legacyState === 'invalid') {
      navigate('/', { replace: true, state: { legacyNotice: true } });
    }
  }, [legacyRoute, legacyState, navigate]);

  useEffect(() => {
    if (!legacyRoute || !legacyToken || legacyLookupStarted.current === legacyToken) return;
    legacyLookupStarted.current = legacyToken;
    getLegacyLink(legacyToken)
      .then((profile) => {
        if (!profile) {
          setLegacyState('invalid');
          return;
        }
        setLegacyProfile(profile);
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setEmail(profile.email || '');
        setCompany(profile.company || '');
        setSite(profile.site || '');
        setLegacyState('ready');
      })
      .catch(() => setLegacyState('error'));
  }, [legacyRoute, legacyToken]);

  useEffect(() => {
    if (mode !== 'register' && !(legacyRoute && legacyState === 'ready')) return undefined;

    let active = true;
    setRegistrationOptionsLoading(true);
    setRegistrationOptionsLoaded(false);
    setRegistrationOptionsFailed(false);
    getRegistrationOptions()
      .then((options) => {
        if (!active) return;
        setRegistrationOptions(options);
        const matchOption = (choices, value) => choices.find(
          (choice) => choice.toLocaleLowerCase() === String(value || '').toLocaleLowerCase(),
        ) || '';
        setCompany((current) => legacyRoute && legacyProfile
          ? matchOption(options.companies, legacyProfile.company)
          : (options.companies.includes(current) ? current : ''));
        setSite((current) => legacyRoute && legacyProfile
          ? matchOption(options.sites, legacyProfile.site)
          : (options.sites.includes(current) ? current : ''));
        setRegistrationOptionsLoaded(true);
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
  }, [mode, legacyRoute, legacyState, legacyProfile, registrationOptionsReload]);

  const resetForm = (newMode) => {
    setMode(newMode);
    setStep('form');
    setError('');
    setPhoneError('');
    setNoticeKey('');
    setOtp('');
    setPrivacyAccepted(false);
    setEmailTouched(false);
  };

  const isRegisterValid = firstName.trim() && lastName.trim() && phone.trim()
    && isValidEmail(email) && company && site && privacyAccepted
    && !registrationOptionsFailed && !registrationOptionsLoading;
  const isLoginValid = phone.trim();
  const isLegacyValid = phone.trim()
    && company && site && registrationOptionsLoaded && !registrationOptionsFailed
    && !registrationOptionsLoading && privacyAccepted;

  const legacyAuthError = (result) => t({
    CodeMismatchException: 'legacyOtpInvalid',
    ExpiredCodeException: 'legacyOtpExpired',
    UserNotFoundException: 'legacyAccountMissing',
  }[result?.errorCode] || 'legacyAuthError');

  const handleSendOTP = async () => {
    if (legacyRoute) {
      if (!isLegacyValid) return;
      if (!validatePhoneNumber(phone).valid) {
        setPhoneError(t('invalidPhoneNumber'));
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      setPhoneError('');
      const privacyAcceptedAt = new Date().toISOString();
      try {
        const account = await getPhoneAccountStatus(phone);
        if (!account) {
          setError(t('accountCheckError'));
          setLoading(false);
          return;
        }
        if (account.flow === 'preview' || account.flow === 'personal-code') {
          setLegacyAccessNotice(true);
          setLoading(false);
          return;
        }

        const flowOverride = account.exists ? 'login' : 'register';
        const userData = {
          firstName,
          lastName,
          email,
          company,
          site,
          legacyToken,
          privacy_policy_consent: true,
          privacyAcceptedAt,
        };
        const result = await requestOTP(phone, userData, flowOverride);
        if (!result?.success) {
          setError(legacyAuthError(result));
          setLoading(false);
          return;
        }
        setOtpMeta({
          phoneE164: result.phoneE164 || phone,
          isRegister: flowOverride === 'register',
          userData,
          flowOverride,
          isLegacy: true,
        });
        setStep('otp');
      } catch {
        setError(t('accountCheckError'));
      }
      setLoading(false);
      return;
    }

    if (mode === 'register' && !isRegisterValid) return;
    if (!validatePhoneNumber(phone).valid) {
      setPhoneError(t('invalidPhoneNumber'));
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    setPhoneError('');

    const userData = mode === 'register'
      ? {
        firstName, lastName, email: email.trim(), company, site,
        privacy_policy_consent: true,
        privacyAcceptedAt: new Date().toISOString(),
      }
      : {};

    let flow;
    try {
      if (mode === 'register') {
        const lookup = await lookupLegacyEmail(email.trim());
        if (lookup.status === 'legacy_email_sent') {
          setLoading(false);
          setLegacyEmailSent(true);
          return;
        }
        if (lookup.status === 'migrated') {
          setLoading(false);
          setNoticeKey('legacyAlreadyMigratedNotice');
          return;
        }
      }
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

    if (['admin-preview-code', 'personal-access-code'].includes(flow.kind)) {
      setOtpMeta({
        phoneE164: phone,
        isRegister: false,
        userData: {},
        isPreviewAdmin: flow.kind === 'admin-preview-code',
        isPersonalCode: flow.kind === 'personal-access-code',
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

    if (otpMeta.isPreviewAdmin || otpMeta.isPersonalCode) {
      const previewSession = await verifyPreviewAdmin(
        phone,
        otp,
        otpMeta.previewChallenge,
      );
      if (!previewSession) {
        setLoading(false);
        setError(t('accessCodeInvalid'));
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
      setError(otpMeta.isLegacy ? legacyAuthError(result) : (result.error || 'Errore'));
    }
  };

  const handleRequestSmsOTP = async () => {
    if (otpMeta.isPersonalCode) return;
    setLoading(true);
    setError('');
    const result = await requestOTP(
      otpMeta.phoneE164 || phone,
      otpMeta.isLegacy ? otpMeta.userData : {},
      otpMeta.isLegacy ? otpMeta.flowOverride : undefined,
    );
    setLoading(false);
    if (!result.success) {
      setError(otpMeta.isLegacy ? legacyAuthError(result) : (result.error || 'Errore invio OTP'));
      return;
    }
    setOtp('');
    setOtpMeta({
      phoneE164: result.phoneE164,
      isRegister: otpMeta.isLegacy ? otpMeta.isRegister : result.isRegister,
      userData: otpMeta.isLegacy ? otpMeta.userData : {},
      isPreviewAdmin: false,
      isLegacy: otpMeta.isLegacy,
      flowOverride: otpMeta.flowOverride,
    });
  };

  return (
    <div className="login-page">
      {/* Header */}
      <div className="login-header">
        <img src={siteImages.appLogo} alt="Step2Connect" className="login-logo-img" />
        <p className="login-tagline">{t('tagline')}</p>

        {/* Language selector */}
        <div className="lang-selector">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang-pill ${lang === l.code ? 'active' : ''}`}
              onClick={() => changeLang(l.code)}
            >
              {legacyRoute ? l.label : `${l.flag} ${l.label}`}
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="login-card">
        {legacyRoute && (
          <div className="legacy-login-heading">
            <h1 style={{ color: 'var(--navy)', fontSize: '1.25rem', lineHeight: 1.25, margin: '0 0 8px', textAlign: 'center' }}>
              {t('legacyWelcomeTitle')}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.45, margin: '0 0 20px', textAlign: 'center' }}>
              {t('legacyWelcomeIntro')}
            </p>
          </div>
        )}
        {/* Mode tabs */}
        {!legacyRoute && <div className="login-tabs">
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
        </div>}

        {legacyRoute && ['idle', 'loading'].includes(legacyState) ? (
          <p className="account-notice" role="status">{t('legacyLoading')}</p>
        ) : legacyRoute && (legacyState === 'invalid' || legacyState === 'error') ? (
          <>
            <p className="account-notice" role="alert">
              {t(legacyState === 'invalid' ? 'legacyInvalidLinkNotice' : 'legacyLoadError')}
            </p>
            <button className="btn-primary" onClick={() => navigate('/', { replace: true })}>
              {t('legacyStandardLogin')}
            </button>
          </>
        ) : legacyRoute && legacyAccessNotice ? (
          <>
            <p className="account-notice" role="status">{t('legacyDedicatedAccessNotice')}</p>
            <button className="btn-primary" onClick={() => navigate('/', { replace: true })}>
              {t('legacyStandardLogin')}
            </button>
          </>
        ) : step === 'form' ? (
          <>
            {noticeKey && <p className="account-notice">{t(noticeKey)}</p>}
            {legacyRoute ? (
              <>
                <div className="input-group">
                  <User size={18} className="input-icon" />
                  <input className="text-input" type="text" value={firstName} readOnly
                    aria-label={t('legacyFirstNameLabel')} />
                </div>
                <div className="input-group">
                  <User size={18} className="input-icon" />
                  <input className="text-input" type="text" value={lastName} readOnly
                    aria-label={t('legacyLastNameLabel')} />
                </div>
                <div className="input-group">
                  <Mail size={18} className="input-icon" />
                  <input className="text-input" type="email" value={email} readOnly
                    aria-label={t('legacyEmailLabel')} />
                </div>
                <div className="input-group">
                  <Building2 size={18} className="input-icon" />
                  <select className="text-input select-input" value={company}
                    onChange={(e) => setCompany(e.target.value)} required
                    aria-label={t('legacyCompanyLabel')} disabled={registrationOptionsLoading}>
                    <option value="">{t('selectCompany')}</option>
                    {registrationOptions.companies.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <HardHat size={18} className="input-icon" />
                  <select className="text-input select-input" value={site}
                    onChange={(e) => setSite(e.target.value)} required
                    aria-label={t('legacySiteLabel')} disabled={registrationOptionsLoading}>
                    <option value="">{t('selectSite')}</option>
                    {registrationOptions.sites.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <p className="login-phone-hint">{t('loginPhoneHint')}</p>
                <div className="input-group">
                  <Phone size={18} className="input-icon" />
                  <input className="text-input" type="tel" value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                    placeholder={t('phonePlaceholder')} inputMode="tel" required
                    aria-label={t('phoneLabel')} />
                </div>
                <div className="login-privacy-consent">
                  <input id="legacy-privacy-accepted" type="checkbox"
                    checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    required aria-labelledby="legacy-privacy-accepted-label" />
                  <div id="legacy-privacy-accepted-label">
                    <label htmlFor="legacy-privacy-accepted">{t('privacyConsentPrefix')}</label>
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPolicyInline')}</a>
                    <label htmlFor="legacy-privacy-accepted">{t('privacyConsentSuffix')} *</label>
                  </div>
                </div>
                <button className="btn-primary" onClick={handleSendOTP}
                  disabled={loading || !isLegacyValid}>
                  {loading ? '...' : t('legacyContinue')}
                </button>
                {registrationOptionsFailed && (
                  <>
                    <p className="error-text">{t('registrationOptionsError')}</p>
                    <button className="btn-ghost"
                      onClick={() => setRegistrationOptionsReload((value) => value + 1)}
                      disabled={registrationOptionsLoading}>{t('retry')}</button>
                  </>
                )}
              </>
            ) : mode === 'register' ? (
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

                {/* Email obbligatoria per il controllo del registro legacy */}
                <div className="input-group">
                  <Mail size={18} className="input-icon" />
                  <input
                    className="text-input"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setNoticeKey(''); }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder={t('emailPlaceholder')}
                    required
                    aria-label={t('legacyEmailLabel')}
                    aria-invalid={emailTouched && !isValidEmail(email)}
                    aria-describedby={emailTouched && !isValidEmail(email) ? 'registration-email-error' : undefined}
                  />
                </div>
                {emailTouched && !isValidEmail(email) && (
                  <p className="error-text" id="registration-email-error" role="alert">
                    {t(email.trim() ? 'invalidEmail' : 'emailRequired')}
                  </p>
                )}

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

                <div className="login-privacy-consent">
                  <input
                    id="privacy-accepted"
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    required
                    aria-labelledby="privacy-accepted-label"
                  />
                  <div id="privacy-accepted-label">
                    <label htmlFor="privacy-accepted">{t('privacyConsentPrefix')}</label>
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPolicyInline')}</a>
                    <label htmlFor="privacy-accepted">{t('privacyConsentSuffix')} *</label>
                  </div>
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
              {otpMeta.isPersonalCode ? t('personalAccessCodePrompt')
                : otpMeta.isPreviewAdmin ? t('accessCodePrompt') : t('otpSent')}:{' '}
              <strong>{otpMeta.phoneE164 || phone}</strong>
            </p>
            <div className="input-group">
              <Hash size={18} className="input-icon" />
              <input
                className="text-input otp-input"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t(otpMeta.isPersonalCode ? 'personalAccessCodePlaceholder' : 'otpPlaceholder')}
                aria-label={t(otpMeta.isPersonalCode ? 'personalAccessCodePlaceholder' : 'otpPlaceholder')}
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
            {!otpMeta.isRegister && !otpMeta.isPersonalCode && (
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
        <p className="login-privacy-footer">
          <a href="/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPolicyLink')}</a>
        </p>
      </div>
      {legacyEmailSent && (
        <dialog ref={emailSentDialog} className="legacy-email-dialog"
          aria-describedby="legacy-email-sent-message"
          aria-label={t('legacyEmailSentTitle')}
          onCancel={() => { setLegacyEmailSent(false); resetForm('login'); navigate('/', { replace: true }); }}>
          <p id="legacy-email-sent-message">{t('legacyEmailSentNotice')}</p>
          <button className="btn-primary" autoFocus onClick={() => {
            setLegacyEmailSent(false);
            resetForm('login');
            navigate('/', { replace: true });
          }}>{t('legacyEmailSentOk')}</button>
        </dialog>
      )}
    </div>
  );
}
