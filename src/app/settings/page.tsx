"use client";

import { BellRing, CalendarDays, Check, Copy, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { defaultPreferences, loadPreferences, savePreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

type CalendarFeed = { url: string; webcalUrl: string };
const eventTypeOptions = ["Schulische Veranstaltung", "Probe", "Feier", "Vortrag", "Aufführung", "Konzert", "Termin", "Sonstiges"];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeed | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [copied, setCopied] = useState(false);

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
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js");
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    updatePreference("browserNotifications", result === "granted");
  }

  function updateCalendarSelection<K extends "calendarFeedScope" | "calendarFeedEventTypes">(key: K, value: AppPreferences[K]) {
    updatePreference(key, value);
    setCalendarFeed(null);
  }

  async function loadCalendarFeed() {
    setCalendarError("");
    const auth = await supabase?.auth.getSession();
    const accessToken = auth?.data.session?.access_token;
    if (!accessToken) {
      setCalendarError("Bitte melde dich erneut an, um den Kalender-Link zu erstellen.");
      return;
    }
    const response = await fetch("/api/calendar-feed/token", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ eventTypes: preferences.calendarFeedEventTypes, scope: preferences.calendarFeedScope })
    });
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

  return (
    <RouteGuard>
      <AppShell title="Einstellungen" eyebrow="Deine App" titleIcon={<Settings2 size={28} />} contentClassName="settings-page">
        <section className="settings-layout">
          <section className="settings-section">
            <header className="settings-section-head">
              <BellRing size={22} />
              <div><h2>Gerätehinweise</h2><p>Wähle aus, welche Hinweise auf diesem Gerät erscheinen dürfen.</p></div>
            </header>
            <div className="settings-options">
              <SettingToggle label="Neue Einteilungen und Erinnerungen" description="Wenn du eingeteilt wirst oder ein Einsatz bald beginnt." checked={preferences.notifyAssignments} onChange={(checked) => updatePreference("notifyAssignments", checked)} />
              <SettingToggle label="Fehlende Besetzung" description="Hinweis auf baldige Veranstaltungen, für die noch Leute fehlen." checked={preferences.notifyUnstaffed} onChange={(checked) => updatePreference("notifyUnstaffed", checked)} />
              <SettingToggle label="Erfolge" description="Hinweise bei neuen Meilensteinen im Levelsystem." checked={preferences.notifyAchievements} onChange={(checked) => updatePreference("notifyAchievements", checked)} />
              <SettingToggle label="Neue Anfragen und Vorschläge" description="Neue Formulare, Bewerbungen und Regelvorschläge für Admins." checked={preferences.notifyAdminUpdates} onChange={(checked) => updatePreference("notifyAdminUpdates", checked)} />
            </div>
            <div className="settings-action-row">
              <div><strong>Hinweise auf diesem Gerät</strong><span>{permissionLabel(permission)}</span></div>
              <button className="button primary" type="button" onClick={enableBrowserNotifications} disabled={permission === "denied" || permission === "unsupported"}>
                <BellRing size={16} /> {permission === "granted" ? "Aktiviert" : "Aktivieren"}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <header className="settings-section-head">
              <CalendarDays size={22} />
              <div><h2>Kalender</h2><p>Lege deine Standardansicht und den Inhalt deines Kalender-Abos fest.</p></div>
            </header>
            <div className="settings-segmented" aria-label="Standardansicht">
              <button className={preferences.defaultCalendarView === "month" ? "is-active" : ""} type="button" onClick={() => updatePreference("defaultCalendarView", "month")}>Monat</button>
              <button className={preferences.defaultCalendarView === "week" ? "is-active" : ""} type="button" onClick={() => updatePreference("defaultCalendarView", "week")}>Woche</button>
            </div>
            <div className="calendar-divider" />
            <div className="calendar-feed-choice">
              <strong>Was soll im persönlichen Kalender erscheinen?</strong>
              <div className="settings-choice-grid">
                <ChoiceButton active={preferences.calendarFeedScope === "assigned"} label="Meine Einteilungen" description="Nur Veranstaltungen, bei denen du eingeteilt bist." onClick={() => updateCalendarSelection("calendarFeedScope", "assigned")} />
                <ChoiceButton active={preferences.calendarFeedScope === "all"} label="Alle Veranstaltungen" description="Der vollständige AK-Motion-Kalender." onClick={() => updateCalendarSelection("calendarFeedScope", "all")} />
                <ChoiceButton active={preferences.calendarFeedScope === "types"} label="Bestimmte Arten" description="Nur die unten ausgewählten Veranstaltungsarten." onClick={() => updateCalendarSelection("calendarFeedScope", "types")} />
              </div>
              {preferences.calendarFeedScope === "types" ? (
                <div className="calendar-type-options">
                  {eventTypeOptions.map((eventType) => (
                    <label key={eventType}>
                      <input type="checkbox" checked={preferences.calendarFeedEventTypes.includes(eventType)} onChange={(event) => updateCalendarSelection(
                        "calendarFeedEventTypes",
                        event.target.checked
                          ? [...preferences.calendarFeedEventTypes, eventType]
                          : preferences.calendarFeedEventTypes.filter((item) => item !== eventType)
                      )} />
                      <span>{eventType}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="calendar-divider" />
            <div className="calendar-subscription">
              <div><strong>Persönlichen Kalender verbinden</strong><span>Apple Kalender und andere Kalender-Apps aktualisieren dieses Abo regelmäßig.</span></div>
              {!calendarFeed ? (
                <button className="button" type="button" onClick={loadCalendarFeed} disabled={preferences.calendarFeedScope === "types" && preferences.calendarFeedEventTypes.length === 0}>Kalender-Link erstellen</button>
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

        </section>
      </AppShell>
    </RouteGuard>
  );
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-toggle"><span><strong>{label}</strong><span>{description}</span></span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function ChoiceButton({ active, label, description, onClick }: { active: boolean; label: string; description: string; onClick: () => void }) {
  return <button className={active ? "is-active" : ""} type="button" onClick={onClick}><strong>{label}</strong><span>{description}</span></button>;
}

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Hinweise sind erlaubt. Auf dem iPhone funktioniert das in der Home-Bildschirm-App.";
  if (permission === "denied") return "Im Browser blockiert. Ändere das in den Website-Einstellungen.";
  if (permission === "unsupported") return "Öffne die App auf dem iPhone über das Symbol auf dem Home-Bildschirm.";
  return "Einmalig für diesen Browser oder dieses Gerät freigeben.";
}
