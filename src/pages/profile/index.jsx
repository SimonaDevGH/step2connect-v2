import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Building2, Check, ChevronRight, HardHat, IdCard, Info, LogOut, Mail, Pencil, Phone, ShieldCheck, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSections } from '../../context/SectionsContext';
import { canSeeSection } from '../../lib/sectionAccess';
import './profile.css';

const detailFields = [
  ['firstName', 'profileFirstName', User],
  ['lastName', 'profileLastName', User],
  ['email', 'profileEmail', Mail],
  ['phone', 'profilePhone', Phone],
  ['company', 'profileCompany', Building2],
  ['site', 'profileSite', HardHat],
];

function ProfileHero({ title, backTo, backLabel }) {
  const navigate = useNavigate();
  return (
    <header className="profile-hero">
      <button type="button" className="profile-back" onClick={() => navigate(backTo)} aria-label={backLabel}>
        <span aria-hidden="true">‹</span>{backLabel}
      </button>
      <h1>{title}</h1>
    </header>
  );
}

function LoadingDetails() {
  const { t } = useLanguage();
  return (
    <div className="profile-card profile-details-skeleton" aria-label={t('profileLoading')} role="status">
      {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="profile-skeleton-row"><i /><span><i /><i /></span></div>)}
    </div>
  );
}

function ErrorNotice({ message, retry }) {
  const { t } = useLanguage();
  return (
    <div className="profile-error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={retry}>{t('retry')}</button>
    </div>
  );
}

function useProfileDetails() {
  const { loadProfileDetails, user, profileReady, isCognitoSession } = useAuth();
  const loadRef = useRef(loadProfileDetails);
  loadRef.current = loadProfileDetails;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!profileReady) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.resolve().then(() => loadRef.current()).then((result) => {
      if (alive) setDetails(result);
    }).catch(() => {
      if (alive) setFailed(true);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [attempt, user?.phone, profileReady, isCognitoSession]);
  return { details, loading, failed, retry: () => setAttempt((value) => value + 1) };
}

function displayName(details, user) {
  return [details?.firstName || user?.firstName, details?.lastName || user?.lastName].filter(Boolean).join(' ').trim()
    || user?.name || user?.phone || '';
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { sections, sectionsReady } = useSections();
  const navigate = useNavigate();
  const { details, loading, failed, retry } = useProfileDetails();
  const name = displayName(details, user);
  const firstName = details?.firstName || user?.firstName || '';
  const lastName = details?.lastName || user?.lastName || '';
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toLocaleUpperCase() || name.slice(0, 1).toLocaleUpperCase();
  const site = details?.site || user?.site;
  const showBadges = sectionsReady && canSeeSection('quiz', user, sections);
  const onLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <section className="profile-page">
      <div className="profile-identity">
        {loading ? <div className="profile-avatar profile-avatar--loading" aria-hidden="true" /> : (
          <div className="profile-avatar" aria-label={t('profileAvatar')}>{initials || <User size={31} />}</div>
        )}
        <div className="profile-identity-copy">
          {loading ? <><i className="profile-name-skeleton" /><i className="profile-site-skeleton" /></> : (
            <>
              <h1>{name || t('profileTitle')}</h1>
              {site && <p>{site}</p>}
            </>
          )}
        </div>
      </div>
      {failed && <ErrorNotice message={t('profileLoadError')} retry={retry} />}
      <div className="profile-card profile-menu-card">
        <button type="button" className="profile-menu-row" onClick={() => navigate('/profile/my-data')}>
          <span className="profile-menu-icon profile-menu-icon--data"><IdCard size={22} /></span>
          <span>{t('profileMyData')}</span><ChevronRight size={20} className="profile-chevron" />
        </button>
        {showBadges && (
          <button type="button" className="profile-menu-row" onClick={() => navigate('/quiz/badges')}>
            <span className="profile-menu-icon profile-menu-icon--badges"><Award size={22} /></span>
            <span>{t('myBadges')}</span><ChevronRight size={20} className="profile-chevron" />
          </button>
        )}
      </div>
      <button type="button" className="profile-logout" onClick={onLogout}>
        <LogOut size={19} /><span>{t('logout')}</span>
      </button>
    </section>
  );
}

export function ProfileDataPage() {
  const { t } = useLanguage();
  const { isCognitoSession, phoneChange } = useAuth();
  const navigate = useNavigate();
  const { details, loading, failed, retry } = useProfileDetails();
  useEffect(() => {
    if (phoneChange?.phase === 'sync') navigate('/profile/my-data/change-phone-verification', { replace: true });
  }, [phoneChange?.phase, navigate]);

  return (
    <section className="profile-page profile-inner-page">
      <ProfileHero title={t('profileMyData')} backTo="/profile" backLabel={t('profileBackProfile')} />
      {loading ? <LoadingDetails /> : failed ? (
        <ErrorNotice message={t('profileLoadError')} retry={retry} />
      ) : (
        <div className="profile-card profile-details-card">
          {detailFields.map(([key, labelKey, Icon]) => (
            <div className="profile-detail-row" key={key}>
              <span className="profile-detail-icon"><Icon size={19} /></span>
              <div className="profile-detail-copy">
                <span className="profile-detail-label">{t(labelKey)}</span>
                <strong>{details?.[key] || <span className="profile-empty-value">{t('profileNotProvided')}</span>}</strong>
              </div>
              {key === 'phone' && isCognitoSession && (
                <button type="button" className="profile-edit-phone" onClick={() => navigate('/profile/my-data/change-phone')}
                  aria-label={t('profileEditPhone')}>
                  <Pencil size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ChangePhonePage() {
  const { t } = useLanguage();
  const { startPhoneChange } = useAuth();
  const navigate = useNavigate();
  const [currentPhone, setCurrentPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await startPhoneChange(currentPhone, newPhone);
      navigate('/profile/my-data/change-phone-verification');
    } catch (err) {
      setError(t(err?.messageKey || 'profilePhoneError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="profile-page profile-inner-page">
      <ProfileHero title={t('profileChangePhoneTitle')} backTo="/profile/my-data" backLabel={t('profileBackData')} />
      <div className="profile-phone-warning"><Info size={21} /><p><strong>{t('profileWarning')}</strong> {t('profilePhoneWarning')}</p></div>
      <form className="profile-card profile-phone-form" onSubmit={submit}>
        <label className="profile-field">
          <span>{t('profileCurrentPhone')}</span>
          <span className="profile-input-wrap"><Phone size={19} /><input type="tel" value={currentPhone} onChange={(event) => setCurrentPhone(event.target.value)} autoComplete="tel" inputMode="tel" required /></span>
        </label>
        <label className="profile-field">
          <span>{t('profileNewPhone')}</span>
          <span className="profile-input-wrap"><Phone size={19} /><input type="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder={t('profilePhonePlaceholder')} autoComplete="tel" inputMode="tel" required /></span>
          <small>{t('profileIntlHint')}</small>
        </label>
        {error && <p className="profile-form-error" role="alert">{error}</p>}
        <button type="submit" className="profile-primary-button" disabled={busy}>{busy ? t('profileWorking') : t('profileConfirmChange')}</button>
        <button type="button" className="profile-ghost-button" onClick={() => navigate('/profile/my-data')}>{t('profileCancel')}</button>
      </form>
    </section>
  );
}

export function PhoneVerificationPage() {
  const { t } = useLanguage();
  const { phoneChange, completedPhone, confirmPhoneChange, resendPhoneChange } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const pending = phoneChange;
  const isSync = pending?.phase === 'sync';
  const seconds = Math.max(0, Math.ceil(((pending?.resendAt || 0) - now) / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!pending) navigate(completedPhone
      ? '/profile/my-data/change-phone-confirmation' : '/profile/my-data/change-phone', { replace: true });
  }, [pending, completedPhone, navigate]);
  const submit = async (event) => {
    event.preventDefault();
    if (busy || (!isSync && code.length !== 6)) return;
    setBusy(true);
    setError('');
    try {
      await confirmPhoneChange(isSync ? '' : code);
      navigate('/profile/my-data/change-phone-confirmation', { replace: true });
    } catch (err) {
      setError(t(err?.messageKey || 'profilePhoneError'));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (seconds > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await resendPhoneChange();
    } catch (err) {
      setError(t(err?.messageKey || 'profilePhoneError'));
    } finally {
      setResending(false);
      setNow(Date.now());
    }
  };
  if (!pending) return null;
  return (
    <section className="profile-page profile-inner-page">
      <ProfileHero title={t('profileVerifyTitle')}
        backTo={isSync ? '/profile/my-data' : '/profile/my-data/change-phone'}
        backLabel={isSync ? t('profileBackData') : t('profileBack')} />
      <form className="profile-card profile-verify-card" onSubmit={submit}>
        <span className="profile-verify-icon">{isSync ? <Users size={27} /> : <ShieldCheck size={28} />}</span>
        {isSync ? (
          <p className="profile-verify-copy">{t('profileSyncRetry')}</p>
        ) : (
          <>
            <p className="profile-verify-copy">{t('profileCodePrompt')}</p>
            <strong className="profile-new-number">{pending?.newPhone}</strong>
            <label className="profile-code-label" htmlFor="profile-phone-code">{t('profileVerificationCode')}</label>
            <input id="profile-phone-code" className="profile-code-input" type="text" value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              aria-label={t('profileVerificationCode')} required />
          </>
        )}
        {error && <p className="profile-form-error" role="alert">{error}</p>}
        <button type="submit" className="profile-primary-button" disabled={busy || (!isSync && code.length !== 6)}>
          {busy ? t('profileWorking') : isSync ? t('profileRetrySync') : t('profileSend')}
        </button>
        {!isSync && (
          <button type="button" className="profile-resend" onClick={resend} disabled={seconds > 0 || resending}>
            {resending ? t('profileWorking') : seconds > 0
              ? t('profileResendCountdown').replace('{seconds}', String(seconds))
              : t('profileResend')}
          </button>
        )}
      </form>
    </section>
  );
}

export function PhoneConfirmationPage() {
  const { t } = useLanguage();
  const { completedPhone } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!completedPhone) navigate('/profile/my-data', { replace: true });
  }, [completedPhone, navigate]);
  if (!completedPhone) return null;
  const [beforePhone, afterPhone] = t('profileUseNewPhone').split('{phone}');
  return (
    <section className="profile-page profile-confirmation-page">
      <span className="profile-success-icon"><Check size={34} /></span>
      <h1>{t('profilePhoneUpdated')}</h1>
      <p className="profile-confirmation-text">{t('profilePhoneSaved')}</p>
      <div className="profile-card profile-confirmed-number">
        <Phone size={21} /><p>{beforePhone}<strong>{completedPhone}</strong>{afterPhone}</p>
      </div>
      <button type="button" className="profile-primary-button" onClick={() => navigate('/profile/my-data')}>{t('profileBackData')}</button>
      <button type="button" className="profile-home-button" onClick={() => navigate('/home')}>{t('profileGoHome')}</button>
    </section>
  );
}
