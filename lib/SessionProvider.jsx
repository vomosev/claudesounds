'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';

const SessionContext = createContext({
  user: null,
  status: 'loading',
  error: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.me();
      const nextUser = data && data.user ? data.user : data;
      if (nextUser && nextUser.id) {
        setUser(nextUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
      return nextUser || null;
    } catch (err) {
      // A 401 is a normal "not signed in" answer, anything else means the
      // API could not be reached and the UI should degrade gracefully.
      if (err && err.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }
      setUser(null);
      setStatus('offline');
      setError(err && err.message ? err.message : 'Unable to reach the ClaudeSounds API.');
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      // Even if the API call fails we clear the local session state so the
      // interface does not pretend the user is still signed in.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Sign out request failed:', err && err.message);
      }
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.me();
        if (cancelled) return;
        const nextUser = data && data.user ? data.user : data;
        if (nextUser && nextUser.id) {
          setUser(nextUser);
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      } catch (err) {
        if (cancelled) return;
        if (err && err.status === 401) {
          setUser(null);
          setStatus('unauthenticated');
        } else {
          setUser(null);
          setStatus('offline');
          setError(
            err && err.message ? err.message : 'Unable to reach the ClaudeSounds API.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ user, status, error, refresh, signOut }),
    [user, status, error, refresh, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export default SessionProvider;