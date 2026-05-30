import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, getToken } from "../api/client";
import type { RegisterPayload, User, UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{
    token?: string;
    user?: User;
    message?: string;
  }>;
  setSessionFromResponse: (token: string, user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const setSessionFromResponse = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await api.register(payload);
    return {
      token: res.token,
      user: res.user,
      message: res.message,
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      setSessionFromResponse,
      refreshUser,
      logout,
      hasRole,
    }),
    [
      user,
      loading,
      login,
      register,
      setSessionFromResponse,
      refreshUser,
      logout,
      hasRole,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
