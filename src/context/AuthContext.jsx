import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  signUp,
  confirmSignUp,
  autoSignIn,
  signIn,
  confirmSignIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  updateUserAttributes,
  confirmUserAttribute,
  sendUserAttributeVerificationCode,
} from 'aws-amplify/auth';
import '../lib/cognito.js'; // initialise Amplify once
import { getMyProfile, syncProfile, getPreviewSession, savePrivacyConsent, completeLegacyMigration } from '../lib/userApi.js';
import { buildPreviewUser } from '../lib/previewSession.js';
import { syncProfileAfterLogin } from '../lib/registrationConsent.js';
import { syncLegacyProfileAfterLogin } from '../lib/legacyLogin.js';
import { getProfileDetails, getPhoneAccountStatus, createPhoneChangeContext, syncChangedPhone } from '../lib/userApi.js';
import { preparePhoneChange, readPhoneChange, storePhoneChange, profileError, phoneChangeError } from '../lib/profilePhoneChange.js';

const AuthContext = createContext(null);

/** Normalizza il numero di telefono in formato E.164 (+39...) */
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('39') && digits.length >= 11) return `+${digits}`;
  if (!raw.startsWith('+')) return `+39${digits}`;
  return raw.trim();
}

/** Recupera l'id token dalla sessione Amplify corrente. Ritorna null se non disponibile. */
async function getIdToken() {
  try {
    const session = await fetchAuthSession();
    return session?.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Costruisce un oggetto utente dai Cognito user attributes. */
function buildUserFromAttributes(attrs) {
  return {
    sub: attrs.sub ?? '',
    phone: attrs.phone_number ?? attrs['custom:phone'] ?? '',
    firstName: attrs.given_name ?? '',
    lastName: attrs.family_name ?? '',
    email: attrs.email ?? '',
    company: attrs['custom:company'] ?? '',
    site: attrs['custom:site'] ?? '',
    name: `${attrs.given_name ?? ''} ${attrs.family_name ?? ''}`.trim() || attrs.phone_number,
    type: 'standard',
  };
}

function mergeProfileIntoUser(setUser, profile, expectedPhone) {
  if (!profile) return;
  setUser((current) => {
    if (!current || current.phone !== expectedPhone) return current;
    const firstName = typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
    const type = ['admin', 'fincantieri_users', 'standard_legacy'].includes(profile.type) ? profile.type : 'standard';
    return {
      ...current,
      type,
      ...(firstName ? {
        firstName,
        name: `${firstName} ${current.lastName ?? ''}`.trim() || current.phone,
      } : {}),
    };
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authMethod, setAuthMethod] = useState(null);
  const [phoneChange, setPhoneChange] = useState(null);
  const [completedPhone, setCompletedPhone] = useState(null);
  const userRef = useRef(user);
  const pendingRef = useRef(phoneChange);
  userRef.current = user;
  pendingRef.current = phoneChange;
  const isCognitoSession = authMethod === 'cognito' && profileReady && user?.type !== 'fincantieri_users';

  const persistPhoneChange = useCallback((pending) => {
    pendingRef.current = pending;
    storePhoneChange(pending);
    setPhoneChange(pending);
  }, []);

  const clearPhoneChange = useCallback(() => {
    // Once Cognito is verified, retain the reference until CRM sync succeeds.
    if (pendingRef.current?.phase !== 'sync') persistPhoneChange(null);
  }, [persistPhoneChange]);
  const clearCompletedPhone = useCallback(() => setCompletedPhone(null), []);

  // Al mount: controlla prima la sessione preview firmata, poi Amplify
  useEffect(() => {
    (async () => {
      try {
        const previewToken = localStorage.getItem('s2c_preview_session');
        if (previewToken) {
          const previewProfile = await getPreviewSession(previewToken);
          if (previewProfile) {
            setAuthMethod('personal-code');
            setUser(buildPreviewUser(previewProfile));
            setProfileReady(true);
            setAuthReady(true);
            return;
          }
          localStorage.removeItem('s2c_preview_session');
        }

        // Sessione Cognito reale
        await getCurrentUser();
        const [attrs, idToken] = await Promise.all([
          fetchUserAttributes(),
          getIdToken(),
        ]);
        const userObj = buildUserFromAttributes(attrs);
        setAuthMethod('cognito');
        persistPhoneChange(readPhoneChange(userObj.sub));
        setUser(userObj);
        // Il primo render non aspetta DynamoDB: il nome si aggiorna appena
        // la lettura del profilo è disponibile.
        if (idToken) {
          getMyProfile(idToken)
            .then((profile) => mergeProfileIntoUser(setUser, profile, userObj.phone))
            .catch(() => {})
            .finally(() => setProfileReady(true));
        } else {
          setProfileReady(true);
        }
      } catch {
        setUser(null);
        setProfileReady(true);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  /**
   * REGISTRAZIONE
   * Chiama signUp + autoSignIn, poi attende confirmSignUp.
   * Restituisce { success, nextStep } oppure { success: false, error }
   */
  const requestOTP = async (phone, userData = {}, flowOverride) => {
    const phoneE164 = normalizePhone(phone);
    try {
      if (flowOverride === 'register' || (flowOverride !== 'login' && userData.firstName)) {
        // ── REGISTER FLOW ──
        const { nextStep } = await signUp({
          username: phoneE164,
          // Cognito richiede una password anche nel flusso passwordless.
          // randomUUID() produce solo hex minuscolo + trattini → non soddisfa la policy
          // "almeno 1 maiuscola, 1 simbolo". Aggiungiamo un suffisso fisso che copre
          // tutte le classi richieste; la password è throwaway e non viene mai usata.
          password: `${crypto.randomUUID()}Xz9!`,
          options: {
            userAttributes: {
              // Il pool Cognito accetta solo phone_number al signUp.
              // Tutti gli altri dati (email, nome, azienda, sito) vengono
              // persistiti nel nostro backend tramite syncProfile dopo il login.
              phone_number: phoneE164,
            },
            autoSignIn: { authFlowType: 'USER_AUTH' },
          },
        });
        return { success: true, nextStep, isRegister: true, phoneE164 };
      } else {
        // ── LOGIN FLOW ──
        const { nextStep } = await signIn({
          username: phoneE164,
          options: {
            authFlowType: 'USER_AUTH',
            preferredChallenge: 'SMS_OTP',
          },
        });
        return { success: true, nextStep, isRegister: false, phoneE164 };
      }
    } catch (err) {
      if (flowOverride) console.error('[legacy] SMS authentication request failed');
      else console.error('[AUTH] requestOTP error:', err);
      return { success: false, error: err.message ?? 'Errore invio OTP',
        ...(flowOverride ? { errorCode: err.name } : {}) };
    }
  };

  /**
   * VERIFICA OTP
   * isRegister=true → confirmSignUp + autoSignIn
   * isRegister=false → confirmSignIn
   * Dopo login: syncProfile + carica attributi.
   */
  const login = async (phoneE164, code, userData = {}, isRegister = false) => {
    try {
      if (isRegister) {
        // Conferma registrazione
        const { nextStep } = await confirmSignUp({
          username: phoneE164,
          confirmationCode: code,
        });
        if (nextStep?.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
          await autoSignIn();
        }
      } else {
        // Conferma login
        await confirmSignIn({ challengeResponse: code });
      }

      // Recupera attributi e idToken
      const [attrs, idToken] = await Promise.all([
        fetchUserAttributes(),
        getIdToken(),
      ]);
      const userObj = buildUserFromAttributes(attrs);
      const profileHint = {
        phone: userObj.phone,
        firstName: userData.firstName ?? userObj.firstName,
        lastName: userData.lastName ?? userObj.lastName,
        email: userData.email ?? userObj.email,
        company: userData.company ?? userObj.company,
        site: userData.site ?? userObj.site,
      };
      setProfileReady(false);
      setAuthMethod('cognito');
      persistPhoneChange(readPhoneChange(userObj.sub));
      setUser({
        ...userObj,
        ...profileHint,
        name: `${profileHint.firstName ?? ''} ${profileHint.lastName ?? ''}`.trim() || userObj.phone,
      });

      // Sincronizza il profilo con il backend (non-blocking)
      if (idToken) {
        const profileSync = userData.legacyToken ? syncLegacyProfileAfterLogin({
          idToken, profile: profileHint, token: userData.legacyToken,
          consent: userData, syncProfile, savePrivacyConsent, completeLegacyMigration,
        }) : syncProfileAfterLogin({
          isRegister, idToken, profile: profileHint, consent: userData,
          syncProfile, savePrivacyConsent,
        });
        profileSync.then(() => getMyProfile(idToken))
          .then((profile) => mergeProfileIntoUser(setUser, profile, profileHint.phone))
          .catch(() => {})
          .finally(() => setProfileReady(true));
      } else {
        if (userData.legacyToken) console.warn('[legacy] authenticated token unavailable; migration not completed');
        else if (isRegister) console.warn('[privacy-consent] authenticated token unavailable; consent not saved');
        setProfileReady(true);
      }

      return { success: true };
    } catch (err) {
      if (userData.legacyToken) console.error('[legacy] SMS authentication verification failed');
      else console.error('[AUTH] login/verify error:', err);
      let message = err.message ?? 'Codice non valido';
      if (err.name === 'CodeMismatchException') message = 'Codice OTP errato';
      if (err.name === 'ExpiredCodeException') message = 'Codice scaduto, richiedine uno nuovo';
      if (err.name === 'NotAuthorizedException') message = 'Accesso non autorizzato';
      return { success: false, error: message,
        ...(userData.legacyToken ? { errorCode: err.name } : {}) };
    }
  };

  const logout = async () => {
    localStorage.removeItem('s2c_preview_session');
    persistPhoneChange(null);
    setCompletedPhone(null);
    setAuthMethod(null);
    try {
      await signOut();
    } catch (err) {
      console.warn('[AUTH] signOut error:', err);
    } finally {
      setUser(null);
      setProfileReady(false);
    }
  };

  const loginPreviewSession = (previewSession) => {
    persistPhoneChange(null);
    setCompletedPhone(null);
    setAuthMethod('personal-code');
    localStorage.setItem('s2c_preview_session', previewSession.token);
    setUser(buildPreviewUser(previewSession));
    setProfileReady(true);
  };

  const loadProfileDetails = useCallback(async () => {
    const owner = userRef.current;
    if (!owner) throw profileError('profileSessionRequired');
    if (!isCognitoSession) return Object.fromEntries(
      ['firstName', 'lastName', 'email', 'phone', 'company', 'site'].map((key) => [key, owner[key] || '']),
    );
    try {
      const idToken = await getIdToken();
      if (!idToken) throw profileError('profileSessionRequired');
      const profile = await getProfileDetails(idToken);
      setUser(current => current?.sub === owner.sub && current.phone === owner.phone
        ? { ...current, ...profile, name: `${profile.firstName} ${profile.lastName}`.trim() || current.phone } : current);
      return profile;
    } catch (error) { throw phoneChangeError(error, 'profileLoadError'); }
  }, [isCognitoSession]);

  const startPhoneChange = async (currentPhone, newPhone) => {
    if (!isCognitoSession || !user?.sub) throw profileError('profileSessionRequired');
    if (pendingRef.current?.phase === 'sync') throw profileError('profileSyncError');
    try {
      const idToken = await getIdToken();
      if (!idToken) throw profileError('profileSessionRequired');
      const pending = await preparePhoneChange({
        currentPhone, newPhone, profilePhone: user.phone, subject: user.sub,
        getAccountStatus: getPhoneAccountStatus,
        createContext: phone => createPhoneChangeContext(idToken, phone),
        updateAttributes: updateUserAttributes,
      });
      setCompletedPhone(null);
      persistPhoneChange(pending);
      return pending;
    } catch (error) { throw phoneChangeError(error); }
  };

  const confirmPhoneChange = async (code) => {
    const pending = pendingRef.current;
    if (!isCognitoSession || !pending || pending.subject !== user?.sub) throw profileError('profileSessionRequired');
    try {
      if (pending.phase !== 'sync') {
        await confirmUserAttribute({ userAttributeKey: 'phone_number', confirmationCode: code });
        persistPhoneChange({ ...pending, phase: 'sync' });
      }
      const session = await fetchAuthSession({ forceRefresh: true });
      const token = session?.tokens?.idToken?.toString();
      if (!token) throw profileError('profileSyncError');
      const result = await syncChangedPhone(token, pending.profileReference);
      if (result.phone !== pending.newPhone) throw profileError('profileSyncError');
      setUser(current => current?.sub === pending.subject
        ? { ...current, phone: result.phone, ...(current.name === current.phone ? { name: result.phone } : {}) } : current);
      setCompletedPhone(result.phone);
      persistPhoneChange(null);
      return result;
    } catch (error) {
      throw phoneChangeError(error, pendingRef.current?.phase === 'sync' ? 'profileSyncError' : 'profilePhoneError');
    }
  };

  const resendPhoneChange = async () => {
    const pending = pendingRef.current;
    if (!isCognitoSession || !pending || pending.subject !== user?.sub || pending.phase === 'sync') {
      throw profileError('profileSessionRequired');
    }
    if (Date.now() < pending.resendAt) throw profileError('profileResendWait');
    // Reserve the cooldown before the request, including concurrent clicks.
    const next = { ...pending, resendAt: Date.now() + 60_000 };
    persistPhoneChange(next);
    try {
      await sendUserAttributeVerificationCode({ userAttributeKey: 'phone_number' });
      return next;
    } catch (error) { throw phoneChangeError(error); }
  };

  return (
    <AuthContext.Provider value={{
      user, authReady, profileReady, login, requestOTP, logout, loginPreviewSession,
      isCognitoSession, phoneChange, completedPhone, loadProfileDetails,
      startPhoneChange, confirmPhoneChange, resendPhoneChange, clearPhoneChange, clearCompletedPhone,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
