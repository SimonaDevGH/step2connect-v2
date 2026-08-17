import { createContext, useContext, useState, useCallback } from 'react';

const AdminAuthContext = createContext(null);

/** Decodifica il payload JWT senza verifica (solo lato client, per leggere email/name/exp). */
function decodeJWT(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

function loadFromStorage() {
  const token = localStorage.getItem('adminToken');
  if (!token) return { token: null, user: null };
  const payload = decodeJWT(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('adminToken');
    return { token: null, user: null };
  }
  return { token, user: { email: payload.email, name: payload.name } };
}

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState(loadFromStorage);

  const login = useCallback((token, userData) => {
    localStorage.setItem('adminToken', token);
    setState({ token, user: userData });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken');
    setState({ token: null, user: null });
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        adminToken: state.token,
        adminUser:  state.user,
        isLoggedIn: !!state.token,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
