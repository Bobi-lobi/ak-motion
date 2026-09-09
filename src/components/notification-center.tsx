"use client";

import { Bell, CalendarClock, CheckCircle2, Megaphone, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { loadPreferences, type AppPreferences } from "@/lib/preferences";

export function NotificationCenter() {
  const { data, session } = useApp();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const notifications = useMemo(() => buildNotifications(data, session), [data, session]);
  const storageKey = session?.id ? `ak-motion-read-notifications:${session.id}` : "";
  const browserSeenKey = session?.id ? `ak-motion-browser-notifications:${session.id}` : "";
  const unread = notifications.filter((notification) => !readIds.includes(notification.id)).length;

  useEffect(() => {
    if (!storageKey) {
      setReadIds([]);
      return;
    }
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      setReadIds(Array.isArray(value) ? value : []);
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    const updatePreferences = () => setPreferences(loadPreferences());
    window.addEventListener("ak-motion-preferences", updatePreferences);
    return () => window.removeEventListener("ak-motion-preferences", updatePreferences);
  }, []);

  useEffect(() => {
    if (!browserSeenKey || !preferences.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    const enabled = notifications.filter((notification) => notificationEnabled(notification, preferences));
    const stored = window.localStorage.getItem(browserSeenKey);
    if (!stored) {
      window.localStorage.setItem(browserSeenKey, JSON.stringify(enabled.map((notification) => notification.id)));
      return;
    }
    let seen: string[] = [];
    try {
      const parsed = JSON.parse(stored);
      seen = Array.isArray(parsed) ? parsed : [];
    } catch {
      seen = [];
    }
    enabled.filter((notification) => !seen.includes(notification.id)).forEach((notification) => {
      new Notification(notification.title, { body: notification.body, icon: "/icon.png", tag: notification.id });
    });
    window.localStorage.setItem(browserSeenKey, JSON.stringify(enabled.map((notification) => notification.id)));
  }, [browserSeenKey, notifications, preferences]);

  function openCenter() {
    const nextRead = Array.from(new Set([...readIds, ...notifications.map((notification) => notification.id)]));
    setReadIds(nextRead);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextRead));
    }
    setOpen((current) => !current);
  }

  return (
    <div className="notification-center">
      <button className="icon-button notification-trigger" type="button" aria-label="Benachrichtigungen" onClick={openCenter}>
        <Bell size={19} />
        {unread ? <span className="notification-count">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-popover">
          <header>
            <div>
              <span className="eyebrow">Aktuell</span>
              <h2>Benachrichtigungen</h2>
            </div>
            <Link className="icon-button ghost" href="/settings" aria-label="Benachrichtigungseinstellungen" onClick={() => setOpen(false)}>
              <Settings size={18} />
            </Link>
          </header>
          <div className="notification-list">
            {notifications.length ? notifications.slice(0, 12).map((notification) => (
              <Link className={`notification-entry is-${notification.kind}`} href={notification.href} key={notification.id} onClick={() => setOpen(false)}>
                <span className="notification-kind-icon">{notificationIcon(notification.kind)}</span>
                <span>
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                </span>
              </Link>
            )) : (
              <div className="notification-empty">
                <CheckCircle2 size={23} />
                <strong>Alles erledigt</strong>
                <span>Im Moment gibt es nichts Neues.</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function notificationEnabled(notification: AppNotification, preferences: AppPreferences) {
  if (notification.kind === "assignment") return preferences.notifyAssignments;
  if (notification.kind === "attention") return preferences.notifyUnstaffed;
  if (notification.kind === "achievement") return preferences.notifyAchievements;
  return true;
}

function notificationIcon(kind: AppNotification["kind"]) {
  if (kind === "assignment") return <CalendarClock size={18} />;
  if (kind === "attention") return <TriangleAlert size={18} />;
  if (kind === "admin") return <Bell size={18} />;
  if (kind === "achievement") return <CheckCircle2 size={18} />;
  return <Megaphone size={18} />;
}
