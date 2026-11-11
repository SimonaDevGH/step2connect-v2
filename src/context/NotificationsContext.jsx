import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSections } from './SectionsContext';
import { canSeeSection } from '../lib/sectionAccess';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user, profileReady } = useAuth();
  const { lang } = useLanguage();
  const { sections, sectionsReady } = useSections();
  const enabled = Boolean(user && profileReady && sectionsReady && canSeeSection('notifications', user, sections));
  const scope = `${user?.phone || ''}:${user?.type || ''}:${lang}:${enabled}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const sequence = useRef(0);
  const mutationScope = useRef(null);
  const [state, setState] = useState({ scope: '', items: [], unread: 0, loading: false, error: false });

  const request = useCallback(async (action = '', body) => {
    if (!enabled) return null;
    if (!action && mutationScope.current === scope) return null;
    if (action) mutationScope.current = scope;
    const version = ++sequence.current;
    const current = () => scopeRef.current === scope && version === sequence.current;
    if (!action) setState((old) => ({ ...old, loading: true, error: false }));
    try {
      const token = localStorage.getItem('s2c_preview_session')
        || (await fetchAuthSession())?.tokens?.idToken?.toString();
      if (!token) throw new Error('Authentication required');
      const response = await fetch(`/api/notifications${action}?lang=${lang}`, {
        method: action ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(action ? { 'Content-Type': 'application/json' } : {}) },
        ...(action ? { body: JSON.stringify(body || {}) } : {}),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Notifications HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.items) || typeof data.unread !== 'number') throw new Error('Invalid notifications response');
      if (current()) setState({ scope, items: data.items, unread: data.unread, loading: false, error: false });
      if (scopeRef.current !== scope) throw new Error('Notification session changed');
      return data;
    } catch (error) {
      if (current()) setState((old) => ({
        ...old, scope, loading: false, error: true,
        ...(action ? {} : { items: [], unread: 0 }),
      }));
      throw error;
    } finally {
      if (action && mutationScope.current === scope) mutationScope.current = null;
    }
  }, [enabled, lang, scope]);

  useEffect(() => {
    if (!enabled) return;
    request().catch(() => {});
    const interval = setInterval(() => request().catch(() => {}), 10 * 60 * 1000);
    return () => { clearInterval(interval); sequence.current++; };
  }, [enabled, request]);

  const current = enabled && state.scope === scope;
  return (
    <NotificationsContext.Provider value={{
      items: current ? state.items : [], unread: current ? state.unread : 0,
      loading: enabled && (!current || state.loading), error: current && state.error,
      markRead: (ids) => request('/read', { ids }),
      markAllRead: () => request('/read-all'),
      reload: () => request(),
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() { return useContext(NotificationsContext); }
