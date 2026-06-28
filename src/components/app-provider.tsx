"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginAction, getSession, loadData, loadRemoteData, saveSession } from "@/lib/data-store";
import type { AppData, SessionUser } from "@/lib/types";

type AppContextValue = {
  data: AppData;
  session: SessionUser | null;
  ready: boolean;
  isAdmin: boolean;
  refresh: () => void;
  updateData: (updater: (current: AppData) => AppData) => void;
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
    return loadRemoteData()
      .then((remoteData) => {
        setData(remoteData);
        setSession(getSession());
        setReady(true);
      })
      .catch((error) => {
        console.error("Supabase-Daten konnten nicht geladen werden:", error);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    void refresh();
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
      updateData: (updater) => setData((current) => updater(current)),
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
