"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginAction, getSession, loadData, loadRemoteData, saveSession } from "@/lib/data-store";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
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
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const updateData = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = updater(current);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ak-motion-data", JSON.stringify(next));
      }
      return next;
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

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    const tables = [
      "profiles",
      "event_requests",
      "events",
      "event_availability",
      "event_assignments",
      "event_attendance",
      "registration_requests",
      "knowledge_pages",
      "knowledge_suggestions",
      "landing_content"
    ];

    function scheduleRefresh() {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = setTimeout(() => {
        void refresh();
      }, 180);
    }

    const channel = supabaseClient.channel("ak-motion-app-data");
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    });
    channel.subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      void supabaseClient.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      session,
      ready,
      isAdmin: session?.role === "admin",
      refresh,
      updateData,
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
    [data, ready, refresh, router, session, updateData]
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
