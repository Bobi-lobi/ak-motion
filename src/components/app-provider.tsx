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
  logout: () => Promise<void>;
};

const AppContext = React.createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<AppData>(() => loadData());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setData(loadData());
    setSession(getSession());

    try {
      // Supabase restores the persisted JWT asynchronously. Waiting here avoids
      // an anonymous RLS query winning the race after a reload or direct link.
      if (hasSupabaseConfig && supabase) {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (authError) {
          throw authError;
        }

        if (!authData.session) {
          window.localStorage.removeItem("ak-motion-session");
          setSession(null);
          setReady(true);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, email, avatar_url, phone, role")
          .eq("id", authData.session.user.id)
          .single();

        if (profileError || !profile) {
          throw profileError ?? new Error("Kein Profil für die aktive Sitzung gefunden.");
        }

        const authenticatedUser: SessionUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatar_url ?? "",
          phone: profile.phone ?? "",
          role: profile.role
        };
        window.localStorage.setItem("ak-motion-session", JSON.stringify(authenticatedUser));
        setSession(authenticatedUser);
      }

      const remoteData = await loadRemoteData();
      setData(remoteData);
    } catch (error) {
      console.error("Supabase-Daten konnten nicht geladen werden:", error);
    } finally {
      setReady(true);
    }
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

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(() => {
      // Do not await Supabase calls inside the auth callback itself.
      window.setTimeout(() => {
        void refresh();
      }, 0);
    });

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      authListener.subscription.unsubscribe();
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
        await refresh();
        router.push("/calendar");
      },
      logout: async () => {
        if (hasSupabaseConfig && supabase) {
          await supabase.auth.signOut();
        }
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
