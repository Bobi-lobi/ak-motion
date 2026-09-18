"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { loadPreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
    if (!session || !supabase || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let cancelled = false;
    void (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (!preferences.browserNotifications || !preferences.notifyChatMessages || Notification.permission !== "granted") {
        if (existing) {
          await updatePushSubscription("DELETE", existing);
          await existing.unsubscribe();
        }
        return;
      }
      if (!vapidPublicKey || cancelled) return;
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
      if (!cancelled) await updatePushSubscription("POST", subscription);
    })().catch((error) => console.warn("Push-Anmeldung fehlgeschlagen:", error));
    return () => { cancelled = true; };
  }, [preferences.browserNotifications, preferences.notifyChatMessages, session]);

  useEffect(() => {
    if (!session || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`ak-motion-chat-notifications-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, ({ new: inserted }) => {
        const message = inserted as { attachments?: unknown[]; author_id?: string; body?: string; id?: string };
        if (!message.id || message.author_id === session.id) return;
        if (vapidPublicKey) return;
        const notificationId = `chat:${message.id}`;
        const chatSeenKey = `${seenKey}:chat`;
        const author = profilesRef.current.find((profile) => profile.id === message.author_id);
        const body = message.body?.trim() || (message.attachments?.length ? "Hat ein Bild oder eine Datei gesendet." : "Neue Nachricht");
        void notifyChatMessageOnce(chatSeenKey, {
          body,
          href: "/chat",
          id: notificationId,
          kind: "chat",
          title: `Neue Nachricht von ${author?.name ?? "einem Teammitglied"}`
        }, preferences.browserNotifications && preferences.notifyChatMessages);
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [preferences.browserNotifications, preferences.notifyChatMessages, seenKey, session]);

  return null;
}

async function updatePushSubscription(method: "DELETE" | "POST", subscription: PushSubscription) {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  const value = subscription.toJSON();
  await fetch("/api/push/subscribe", {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(method === "DELETE" ? { endpoint: subscription.endpoint } : value)
  });
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
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
  if (notification.kind === "chat") return preferences.notifyChatMessages;
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

async function notifyChatMessageOnce(seenKey: string, notification: AppNotification, enabled: boolean) {
  const run = async () => {
    const seen = readSeenNotifications(seenKey);
    if (seen.includes(notification.id)) return;
    window.localStorage.setItem(seenKey, JSON.stringify([...seen.slice(-99), notification.id]));
    if (!enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && window.location.pathname === "/chat") return;
    await notifyDevice([notification]);
  };
  if (navigator.locks) {
    await navigator.locks.request(`ak-motion-${notification.id}`, run);
  } else {
    await run();
  }
}
