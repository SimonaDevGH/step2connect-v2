import { createContext, useContext, useState, useEffect } from 'react';
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
} from 'aws-amplify/auth';
import '../lib/cognito.js'; // initialise Amplify once
import { getMyProfile, syncProfile } from '../lib/userApi.js';

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
    phone: attrs.phone_number ?? attrs['custom:phone'] ?? '',
    firstName: attrs.given_name ?? '',
    lastName: attrs.family_name ?? '',
    email: attrs.email ?? '',
    company: attrs['custom:company'] ?? '',
    site: attrs['custom:site'] ?? '',
    name: `${attrs.given_name ?? ''} ${attrs.family_name ?? ''}`.trim() || attrs.phone_number,
  };
}

function mergeProfileIntoUser(setUser, profile, expectedPhone) {
  if (!profile || typeof profile.firstName !== 'string' || !profile.firstName.trim()) return;
  setUser((current) => {
    if (!current || current.phone !== expectedPhone) return current;
    const firstName = profile.firstName.trim();
    return {
      ...current,
      firstName,
      name: `${firstName} ${current.lastName ?? ''}`.trim() || current.phone,
    };
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Al mount: controlla prima la sessione dev, poi Amplify
  useEffect(() => {
    (async () => {
      try {
        // 1. Bypass dev — persiste in localStorage
        const devSession = localStorage.getItem('s2c_dev_session');
        if (devSession) {
          setUser(JSON.parse(devSession));
          setAuthReady(true);
          return;
        }
        // 2. Sessione Cognito reale
        await getCurrentUser();
        const [attrs, idToken] = await Promise.all([
          fetchUserAttributes(),
          getIdToken(),
        ]);
        const userObj = buildUserFromAttributes(attrs);
        setUser(userObj);
        // Il primo render non aspetta DynamoDB: il nome si aggiorna appena
        // la lettura del profilo è disponibile.
        if (idToken) {
          getMyProfile(idToken)
            .then((profile) => mergeProfileIntoUser(setUser, profile, userObj.phone));
        }
      } catch {
        setUser(null);
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
  const requestOTP = async (phone, userData = {}) => {
    const phoneE164 = normalizePhone(phone);
    try {
      if (userData.firstName) {
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
      console.error('[AUTH] requestOTP error:', err);
      return { success: false, error: err.message ?? 'Errore invio OTP' };
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
      setUser({
        ...userObj,
        ...profileHint,
        name: `${profileHint.firstName ?? ''} ${profileHint.lastName ?? ''}`.trim() || userObj.phone,
      });

      // Sincronizza il profilo con il backend (non-blocking)
      if (idToken) {
        const profileSync = syncProfile(idToken, profileHint);
        profileSync.then(() => getMyProfile(idToken))
          .then((profile) => mergeProfileIntoUser(setUser, profile, profileHint.phone));
      }

      return { success: true };
    } catch (err) {
      console.error('[AUTH] login/verify error:', err);
      let message = err.message ?? 'Codice non valido';
      if (err.name === 'CodeMismatchException') message = 'Codice OTP errato';
      if (err.name === 'ExpiredCodeException') message = 'Codice scaduto, richiedine uno nuovo';
      if (err.name === 'NotAuthorizedException') message = 'Accesso non autorizzato';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    localStorage.removeItem('s2c_dev_session');
    try {
      await signOut();
    } catch (err) {
      console.warn('[AUTH] signOut error:', err);
    } finally {
      setUser(null);
    }
  };

  const devLogin = () => {
    const devUser = {
      phone: '+390000000000',
      firstName: 'Utente',
      lastName: 'Test',
      email: '',
      company: 'Fincantieri S.p.A.',
      site: 'Monfalcone (GO)',
      name: 'Utente Test (anteprima)',
    };
    localStorage.setItem('s2c_dev_session', JSON.stringify(devUser));
    setUser(devUser);
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, requestOTP, logout, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
