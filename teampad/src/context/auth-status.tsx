/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api";

export type AuthStatus = "loading" | "guest" | "authed";

type AuthStatusContextValue = {
  status: AuthStatus;
  refresh: () => Promise<void>;
  markGuest: () => void;
};

const AuthStatusContext = createContext<AuthStatusContextValue | null>(null);
const AUTH_STATUS_KEY = "teampad_auth_status";
const AUTH_LOST_EVENT = "teampad:auth-lost";

const readCachedStatus = (): AuthStatus | null => {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(AUTH_STATUS_KEY);
  if (cached === "guest" || cached === "authed") return cached;
  return null;
};

const persistStatus = (status: AuthStatus) => {
  if (typeof window === "undefined") return;
  if (status === "loading") return;
  window.localStorage.setItem(AUTH_STATUS_KEY, status);
};

const isAuthError = (error: unknown) => {
  const err = error as { status?: number; code?: string; message?: string } | null;
  if (!err) return false;
  if (err.status === 401 || err.status === 403) return true;
  if (err.code === "forbidden" || err.code === "unauthorized") return true;
  const message = err.message || "";
  return /unauthorized|forbidden/i.test(message);
};

const resolveAuthStatus = async (): Promise<AuthStatus> => {
  try {
    await api.getMe();
    return "authed";
  } catch (error) {
    if (isAuthError(error)) return "guest";
    return readCachedStatus() || "guest";
  }
};

export const AuthStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>(() => readCachedStatus() || "loading");
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      await api.refreshSession();
    } catch (error) {
      if (isAuthError(error) && isMountedRef.current) {
        setStatus("guest");
        persistStatus("guest");
        return;
      }
    }
    const nextStatus = await resolveAuthStatus();
    if (isMountedRef.current) {
      setStatus(nextStatus);
      persistStatus(nextStatus);
    }
  }, []);

  const markGuest = useCallback(() => {
    if (!isMountedRef.current) return;
    setStatus("guest");
    persistStatus("guest");
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    refresh();
    const shouldRefresh = status === "loading";
    const fallbackId = shouldRefresh
      ? window.setTimeout(() => {
          if (isMountedRef.current) {
            refresh();
          }
        }, 1200)
      : null;

    return () => {
      isMountedRef.current = false;
      if (fallbackId !== null) {
        window.clearTimeout(fallbackId);
      }
    };
  }, [refresh, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleAuthLost = () => {
      if (!isMountedRef.current) return;
      setStatus("guest");
      persistStatus("guest");
    };
    window.addEventListener(AUTH_LOST_EVENT, handleAuthLost as EventListener);
    return () => {
      window.removeEventListener(AUTH_LOST_EVENT, handleAuthLost as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "guest") return;
    const intervalMs = 10 * 60 * 1000;
    const intervalId = window.setInterval(() => {
      refresh();
    }, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh, status]);

  // If auth is lost, always force users back to the Auth page (covers mobile/PWA).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "guest") return;
    const path = window.location.pathname;
    if (!path.startsWith("/auth")) {
      window.location.href = "/auth";
    }
  }, [status]);

  const value = useMemo(() => ({ status, refresh, markGuest }), [status, refresh, markGuest]);

  return <AuthStatusContext.Provider value={value}>{children}</AuthStatusContext.Provider>;
};

export const useAuthStatus = () => {
  const context = useContext(AuthStatusContext);
  if (!context) {
    throw new Error("useAuthStatus must be used within AuthStatusProvider");
  }
  return context;
};
