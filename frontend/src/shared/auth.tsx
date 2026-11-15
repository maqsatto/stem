import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, errorMessage, tokenStore } from "@/shared/api";
import type { AuthResponse, Me, Role } from "@/shared/types";

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  register: (payload: {
    email: string;
    password: string;
    display_name: string;
  }) => Promise<Me>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function roleHome(role: Role | string): string {
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "admin") return "/admin/content";
  return "/student/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const me = await api<Me>("/me");
    setUser(me);
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await api<Me>("/me");
        if (active) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    }
    void bootstrap();
    const onLogout = () => setUser(null);
    window.addEventListener("mlstem:logout", onLogout);
    return () => {
      active = false;
      window.removeEventListener("mlstem:logout", onLogout);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const pair = await api<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    tokenStore.set(pair.access_token, pair.refresh_token);
    const me = await api<Me>("/me");
    setUser(me);
    return me;
  }, []);

  const register = useCallback(
    async (payload: { email: string; password: string; display_name: string }) => {
      const pair = await api<AuthResponse>("/auth/register", {
        method: "POST",
        auth: false,
        body: payload,
      });
      tokenStore.set(pair.access_token, pair.refresh_token);
      const me = await api<Me>("/me");
      setUser(me);
      return me;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", {
        method: "POST",
        body: { refresh_token: tokenStore.refresh },
      });
    } catch {
      // Local logout must succeed even when the network is unavailable.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export { errorMessage };
