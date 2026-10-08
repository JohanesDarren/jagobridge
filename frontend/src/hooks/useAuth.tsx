import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "../lib/api-client";
import type { AuthUser, MeResponse } from "../types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  me: MeResponse | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  acknowledgeUsageNotice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const response = await apiRequest<{ data: MeResponse }>("/users/me");
      setMe(response.data);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setMe(null);
        setStatus("anonymous");
        return;
      }
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ data: { user: AuthUser } }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await refreshMe();
    return response.data.user;
  }, [refreshMe]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  const acknowledgeUsageNotice = useCallback(async () => {
    await apiRequest("/users/me/usage-notice", { method: "PATCH" });
    await refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user: me?.user ?? null, me, login, logout, refreshMe, acknowledgeUsageNotice }),
    [status, me, login, logout, refreshMe, acknowledgeUsageNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
