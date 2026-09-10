"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { loadPreferences, type AppPreferences } from "@/lib/preferences";

export function NotificationDispatcher() {
  const { data, session } = useApp();
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const notifications = useMemo(() => buildNotifications(data, session), [data, session]);
  const seenKey = session?.id ? `ak-motion-device-notifications:${session.id}` : "";

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

  return null;
}

async function notifyDevice(notifications: AppNotification[]) {
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.register("/sw.js") : null;
  for (const notification of notifications) {
    if (registration) {
      await registration.showNotification(notification.title, { body: notification.body, icon: "/icon.png", tag: notification.id, data: { href: notification.href } });
    } else {
      new Notification(notification.title, { body: notification.body, icon: "/icon.png", tag: notification.id });
    }
  }
}

function notificationEnabled(notification: AppNotification, preferences: AppPreferences) {
  if (notification.kind === "assignment") return preferences.notifyAssignments;
  if (notification.kind === "attention") return preferences.notifyUnstaffed;
  if (notification.kind === "achievement") return preferences.notifyAchievements;
  return preferences.notifyAdminUpdates;
}
