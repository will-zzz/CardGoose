import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { apiJson } from '../lib/api';
import { AuthContext } from './auth-context';
import type { AuthUser } from './auth-types';
import { clearAuth, loadStored, persistAuth } from './auth-store';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ token, user }, setAuth] = useState(() => {
    const s = loadStored();
    return { token: s?.token ?? null, user: s?.user ?? null };
  });

  const persist = useCallback((t: string, u: AuthUser) => {
    setAuth({ token: t, user: u });
    persistAuth(t, u);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await apiJson<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      persist(data.token, data.user);
    },
    [persist]
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const data = await apiJson<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      persist(data.token, data.user);
    },
    [persist]
  );

  const logout = useCallback(() => {
    setAuth({ token: null, user: null });
    clearAuth();
  }, []);

  const value = useMemo(
    () => ({ token, user, login, register, logout }),
    [token, user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
