import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  api,
  clearToken,
  setToken,
  setRefreshToken,
  setForceLogoutHandler,
  type User,
} from '../lib/api';
import { secureStorage } from '../lib/storage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Unlike the web version, we can't synchronously check storage (it's
  // async), so `loading` always starts true and the bootstrap effect
  // below resolves it — the RootNavigator shows a splash/spinner until
  // then instead of assuming "no token" on first paint.
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Wire the API client's forced-logout hook (fired when a refresh
    // fails) to actually clear local auth state — the RN equivalent of
    // the web app's `window.location.href = '/'`.
    setForceLogoutHandler(() => {
      if (mounted.current) setUser(null);
    });
    return () => setForceLogoutHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await secureStorage.getItem('qmfg_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        if (mounted.current) setUser(res.user);
      } catch {
        // Access token likely expired — try one refresh before giving up.
        try {
          const { accessToken, refreshToken, user: refreshedUser } =
            await api.refresh();
          await setToken(accessToken);
          await setRefreshToken(refreshToken);
          if (mounted.current) setUser(refreshedUser);
        } catch {
          await clearToken();
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const { accessToken, refreshToken, user: loggedInUser } = await api.login(
      email,
      password,
    );
    await setToken(accessToken);
    await setRefreshToken(refreshToken);
    setUser(loggedInUser);
  }

  async function logout() {
    await api.logout();
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
