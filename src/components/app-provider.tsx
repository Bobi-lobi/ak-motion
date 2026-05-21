"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginAction, getSession, loadData, saveSession } from "@/lib/data-store";
import type { AppData, SessionUser } from "@/lib/types";

type AppContextValue = {
  data: AppData;
  session: SessionUser | null;
  ready: boolean;
  isAdmin: boolean;
  refresh: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AppContext = React.createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<AppData>(() => loadData());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setData(loadData());
    setSession(getSession());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
    window.addEventListener("ak-motion-data", refresh);
    window.addEventListener("ak-motion-session", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ak-motion-data", refresh);
      window.removeEventListener("ak-motion-session", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      session,
      ready,
      isAdmin: session?.role === "admin",
      refresh,
      login: async (email, password) => {
        const user = await loginAction(email, password);
        setSession(user);
        router.push("/calendar");
      },
      logout: () => {
        saveSession(null);
        setSession(null);
        router.push("/login");
      }
    }),
    [data, ready, refresh, router, session]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider.");
  }
  return context;
}
