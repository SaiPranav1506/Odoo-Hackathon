import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '../api/types';
import { authApi } from '../api/endpoints';
import { getAccessToken, clearTokens } from '../api/storage';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  setUser: (u: PublicUser) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
    const onLogout = () => { clearTokens(); setUser(null); };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}