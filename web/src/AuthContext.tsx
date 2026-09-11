import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { SessionUser } from "./types";
import { api } from "./api";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  loginAs: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginAs = useCallback(
    async (userId: string) => {
      await api.devLogin(userId);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, loginAs, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
