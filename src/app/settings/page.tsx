"use client";

import { CalendarDays, Check, Copy, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { defaultPreferences, loadPreferences, savePreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

type CalendarFeed = { url: string; webcalUrl: string };

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeed | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  function updatePreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    savePreferences(next);
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

  return (
    <RouteGuard>
      <AppShell title="Einstellungen" eyebrow="Deine App" titleIcon={<Settings2 size={28} />} contentClassName="settings-page">
        <section className="settings-layout">
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

        </section>
      </AppShell>
    </RouteGuard>
  );
}
