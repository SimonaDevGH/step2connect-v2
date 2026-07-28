import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// ─── INTEGRATION POINT ────────────────────────────────────────────────────────
// Replace sendOTP and verifyOTP with real AWS Cognito / SMS calls.
// sendOTP(phone)         → triggers SMS via Cognito or SNS
// verifyOTP(phone, code) → calls Cognito ConfirmSignIn / VerifyCode
// ─────────────────────────────────────────────────────────────────────────────

async function sendOTP(phone) {
  // MOCK: always succeeds
  console.log('[AUTH] sendOTP called for', phone);
  return { success: true };
}

async function verifyOTP(phone, code, userData) {
  // MOCK: any 4-6 digit code is accepted
  console.log('[AUTH] verifyOTP called', { phone, code, userData });
  if (code.length >= 4) {
    const { firstName, lastName, email, company, site } = userData || {};
    const displayName = firstName
      ? `${firstName}${lastName ? ' ' + lastName : ''}`
      : phone;
    return {
      success: true,
      user: { phone, firstName, lastName, email, company, site, name: displayName },
    };
  }
  return { success: false, error: 'Codice non valido' };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('s2c_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (phone, code, userData) => {
    const result = await verifyOTP(phone, code, userData);
    if (result.success) {
      localStorage.setItem('s2c_user', JSON.stringify(result.user));
      setUser(result.user);
    }
    return result;
  };

  const requestOTP = async (phone) => {
    return sendOTP(phone);
  };

  const logout = () => {
    localStorage.removeItem('s2c_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, requestOTP, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
