"use client";

import { BellRing, CalendarDays, Check, Copy, Megaphone, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import { createAnnouncement, deleteAnnouncement } from "@/lib/data-store";
import { defaultPreferences, loadPreferences, savePreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

type CalendarFeed = { url: string; webcalUrl: string };

export default function SettingsPage() {
  const { data, isAdmin, refresh, session } = useApp();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeed | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [copied, setCopied] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementError, setAnnouncementError] = useState("");

  useEffect(() => {
    setPreferences(loadPreferences());
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  function updatePreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    savePreferences(next);
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    updatePreference("browserNotifications", result === "granted");
  }

  async function loadCalendarFeed() {
    setCalendarError("");
    const auth = await supabase?.auth.getSession();
    const accessToken = auth?.data.session?.access_token;
    if (!accessToken) {
      setCalendarError("Bitte melde dich erneut an, um den Kalender-Link zu erstellen.");
      return;
    }
    const response = await fetch("/api/calendar-feed/token", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) {
      setCalendarError(result.error ?? "Kalender-Link konnte nicht erstellt werden.");
      return;
    }
    setCalendarFeed(result as CalendarFeed);
  }

  async function copyCalendarFeed() {
    if (!calendarFeed) return;
    await navigator.clipboard.writeText(calendarFeed.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function publishAnnouncement() {
    if (!session || !announcementTitle.trim() || !announcementBody.trim()) return;
    setAnnouncementError("");
    try {
      await createAnnouncement(announcementTitle, announcementBody, session);
      setAnnouncementTitle("");
      setAnnouncementBody("");
      await refresh();
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Mitteilung konnte nicht veröffentlicht werden.");
    }
  }

  return (
    <RouteGuard>
      <AppShell title="Einstellungen" eyebrow="Deine App" titleIcon={<Settings2 size={28} />} contentClassName="settings-page">
        <section className="settings-layout">
          <section className="settings-section">
            <header className="settings-section-head">
              <BellRing size={22} />
              <div><h2>Benachrichtigungen</h2><p>Bestimme, welche Hinweise für dich wichtig sind.</p></div>
            </header>
            <div className="settings-options">
              <SettingToggle label="Neue Einteilungen" description="Wenn du einer Veranstaltung zugeteilt wirst." checked={preferences.notifyAssignments} onChange={(checked) => updatePreference("notifyAssignments", checked)} />
              <SettingToggle label="Fehlende Besetzung" description="Admins werden auf baldige unbesetzte Veranstaltungen hingewiesen." checked={preferences.notifyUnstaffed} onChange={(checked) => updatePreference("notifyUnstaffed", checked)} disabled={!isAdmin} />
              <SettingToggle label="Erfolge" description="Hinweise bei neuen Meilensteinen im Levelsystem." checked={preferences.notifyAchievements} onChange={(checked) => updatePreference("notifyAchievements", checked)} />
            </div>
            <div className="settings-action-row">
              <div><strong>Browserhinweise</strong><span>{permissionLabel(permission)}</span></div>
              <button className="button primary" type="button" onClick={enableBrowserNotifications} disabled={permission === "denied" || permission === "unsupported"}>
                <BellRing size={16} /> {permission === "granted" ? "Aktiviert" : "Aktivieren"}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <header className="settings-section-head">
              <CalendarDays size={22} />
              <div><h2>Kalender</h2><p>Öffne standardmäßig deine bevorzugte Ansicht und abonniere deine Einteilungen.</p></div>
            </header>
            <div className="settings-segmented" aria-label="Standardansicht">
              <button className={preferences.defaultCalendarView === "month" ? "is-active" : ""} type="button" onClick={() => updatePreference("defaultCalendarView", "month")}>Monat</button>
              <button className={preferences.defaultCalendarView === "week" ? "is-active" : ""} type="button" onClick={() => updatePreference("defaultCalendarView", "week")}>Woche</button>
            </div>
            <div className="calendar-divider" />
            <div className="calendar-subscription">
              <div><strong>Persönlicher Kalender</strong><span>Enthält nur Veranstaltungen, bei denen du eingeteilt bist. Apple Kalender aktualisiert das Abo regelmäßig.</span></div>
              {!calendarFeed ? (
                <button className="button" type="button" onClick={loadCalendarFeed}>Kalender-Link erstellen</button>
              ) : (
                <div className="calendar-subscription-actions">
                  <a className="button primary" href={calendarFeed.webcalUrl}><CalendarDays size={16} /> In Kalender öffnen</a>
                  <button className="icon-button" type="button" aria-label="Kalender-Link kopieren" onClick={copyCalendarFeed}>{copied ? <Check size={17} /> : <Copy size={17} />}</button>
                </div>
              )}
              {calendarError ? <p className="error-text">{calendarError}</p> : null}
              {calendarFeed ? <p className="settings-secret-note">Behandle diesen Link wie ein Passwort: Wer ihn kennt, kann deine Termine lesen.</p> : null}
            </div>
          </section>

          {isAdmin ? (
            <section className="settings-section settings-announcements">
              <header className="settings-section-head">
                <Megaphone size={22} />
                <div><h2>Mitteilungen</h2><p>Eine Nachricht für alle Mitglieder veröffentlichen.</p></div>
              </header>
              <div className="announcement-composer">
                <input aria-label="Titel der Mitteilung" placeholder="Titel" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} />
                <textarea aria-label="Text der Mitteilung" placeholder="Nachricht an das Team" value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} />
                <button className="button primary" type="button" disabled={!announcementTitle.trim() || !announcementBody.trim()} onClick={publishAnnouncement}><Megaphone size={16} /> Veröffentlichen</button>
                {announcementError ? <p className="error-text">{announcementError}</p> : null}
              </div>
              {data.announcements.length ? <div className="announcement-list">{data.announcements.map((announcement) => (
                <article key={announcement.id}><div><strong>{announcement.title}</strong><p>{announcement.body}</p></div><button className="icon-button danger" type="button" aria-label={`${announcement.title} löschen`} onClick={async () => { await deleteAnnouncement(announcement.id); await refresh(); }}><Trash2 size={16} /></button></article>
              ))}</div> : null}
            </section>
          ) : null}
        </section>
      </AppShell>
    </RouteGuard>
  );
}

function SettingToggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`setting-toggle${disabled ? " is-disabled" : ""}`}><span><strong>{label}</strong><span>{description}</span></span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Hinweise sind auf diesem Gerät erlaubt.";
  if (permission === "denied") return "Im Browser blockiert. Das lässt sich in den Website-Einstellungen ändern.";
  if (permission === "unsupported") return "Auf diesem Gerät nicht verfügbar.";
  return "Optional auf diesem Gerät aktivieren.";
}
