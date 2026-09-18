"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { loadPreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

export function NotificationDispatcher() {
  const { data, session } = useApp();
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const notifications = useMemo(() => buildNotifications(data, session), [data, session]);
  const seenKey = session?.id ? `ak-motion-device-notifications:${session.id}` : "";
  const profilesRef = useRef(data.profiles);

  useEffect(() => {
    profilesRef.current = data.profiles;
  }, [data.profiles]);

  useEffect(() => {
    const updatePreferences = () => setPreferences(loadPreferences());
    window.addEventListener("ak-motion-preferences", updatePreferences);
    return () => window.removeEventListener("ak-motion-preferences", updatePreferences);
  }, []);

  useEffect(() => {
    if (!seenKey || !preferences.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") return;
    const enabled = notifications.filter((notification) => notificationEnabled(notification, preferences));
    const stored = window.localStorage.getItem(seenKey);
    if (!stored) {
      window.localStorage.setItem(seenKey, JSON.stringify(enabled.map((notification) => notification.id)));
      return;
    }
    let seen: string[] = [];
    try {
      const parsed = JSON.parse(stored);
      seen = Array.isArray(parsed) ? parsed : [];
    } catch {
      seen = [];
    }
    const fresh = enabled.filter((notification) => !seen.includes(notification.id));
    if (fresh.length) {
      void notifyDevice(fresh);
    }
    window.localStorage.setItem(seenKey, JSON.stringify(enabled.map((notification) => notification.id)));
  }, [notifications, preferences, seenKey]);

  useEffect(() => {
    if (!session || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`ak-motion-chat-notifications-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, ({ new: inserted }) => {
        const message = inserted as { attachments?: unknown[]; author_id?: string; body?: string; id?: string };
        if (!message.id || message.author_id === session.id) return;
        const notificationId = `chat:${message.id}`;
        const chatSeenKey = `${seenKey}:chat`;
        const seen = readSeenNotifications(chatSeenKey);
        if (seen.includes(notificationId)) return;
        window.localStorage.setItem(chatSeenKey, JSON.stringify([...seen.slice(-99), notificationId]));
        if (!preferences.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") return;
        if (document.visibilityState === "visible" && window.location.pathname === "/chat") return;
        const author = profilesRef.current.find((profile) => profile.id === message.author_id);
        const body = message.body?.trim() || (message.attachments?.length ? "Hat ein Bild oder eine Datei gesendet." : "Neue Nachricht");
        void notifyDevice([{
          body,
          href: "/chat",
          id: notificationId,
          kind: "chat",
          title: `Neue Nachricht von ${author?.name ?? "einem Teammitglied"}`
        }]);
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [preferences.browserNotifications, seenKey, session]);

  return null;
}

async function notifyDevice(notifications: AppNotification[]) {
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.register("/sw.js") : null;
  for (const notification of notifications) {
    if (registration) {
      await registration.showNotification(notification.title, { body: notification.body, icon: "/ak-motion-logo.png", badge: "/ak-motion-logo.png", tag: notification.id, data: { href: notification.href } });
    } else {
      new Notification(notification.title, { body: notification.body, icon: "/ak-motion-logo.png", tag: notification.id });
    }
  }
}

function notificationEnabled(notification: AppNotification, preferences: AppPreferences) {
  if (notification.kind === "assignment") return preferences.notifyAssignments;
  if (notification.kind === "attention") return preferences.notifyUnstaffed;
  if (notification.kind === "achievement") return preferences.notifyAchievements;
  if (notification.kind === "announcement") return true;
  if (notification.kind === "chat") return true;
  return preferences.notifyAdminUpdates;
}

function readSeenNotifications(key: string) {
  if (!key) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
