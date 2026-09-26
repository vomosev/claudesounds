'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { auth as authApi } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      const nextUser = data && data.user ? data.user : null;
      if (!mountedRef.current) return nextUser;
      if (nextUser) {
        setUser(nextUser);
        setStatus('authenticated');
        setError(null);
      } else {
        setUser(null);
        setStatus('anonymous');
      }
      return nextUser;
    } catch (err) {
      // A 401, a network failure or an offline API all mean "not signed in".
      if (mountedRef.current) {
        setUser(null);
        setStatus('anonymous');
        if (err && err.status && err.status !== 401) {
          setError(null);
        }
      }
      return null;
    }
  }, []);

  useEffect(() => {
    // Runtime only — never during SSR or the production build.
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const data = await authApi.login(credentials);
      const nextUser = data && data.user ? data.user : null;
      if (mountedRef.current) {
        setUser(nextUser);
        setStatus(nextUser ? 'authenticated' : 'anonymous');
      }
      return nextUser;
    } catch (err) {
      const message =
        err && err.status
          ? err.message || 'That email and password combination did not match.'
          : "We couldn't reach ClaudeSounds — try again in a moment.";
      if (mountedRef.current) {
        setError(message);
        setStatus('anonymous');
      }
      const wrapped = new Error(message);
      wrapped.status = err && err.status ? err.status : 0;
      throw wrapped;
    }
  }, []);

  const signup = useCallback(async (payload) => {
    setError(null);
    try {
      const data = await authApi.signup(payload);
      const nextUser = data && data.user ? data.user : null;
      if (mountedRef.current) {
        setUser(nextUser);
        setStatus(nextUser ? 'authenticated' : 'anonymous');
      }
      return nextUser;
    } catch (err) {
      const message =
        err && err.status
          ? err.message || 'We could not create that account.'
          : "We couldn't reach ClaudeSounds — try again in a moment.";
      if (mountedRef.current) {
        setError(message);
        setStatus('anonymous');
      }
      const wrapped = new Error(message);
      wrapped.status = err && err.status ? err.status : 0;
      throw wrapped;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Even if the API is unreachable, clear local state so the UI is consistent.
    } finally {
      if (mountedRef.current) {
        setUser(null);
        setStatus('anonymous');
        setError(null);
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      isAuthenticated: status === 'authenticated',
      login,
      signup,
      logout,
      refresh,
      clearError,
    }),
    [user, status, error, login, signup, logout, refresh, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return ctx;
}

export default AuthProvider;