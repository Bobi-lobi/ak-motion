"use client";

import { BellRing, CalendarDays, Check, Copy, Filter, LockKeyhole, MapPin, Megaphone, Settings2, Tags, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { createAnnouncement, deleteAnnouncement } from "@/lib/data-store";
import { defaultPreferences, loadPreferences, savePreferences, type AppPreferences } from "@/lib/preferences";
import { supabase } from "@/lib/supabase";

type CalendarFeed = { url: string; webcalUrl: string };
type CalendarFilterKind = "eventTypes" | "locations" | "profiles";
const eventTypeOptions = ["Schulische Veranstaltung", "Probe", "Feier", "Vortrag", "Aufführung", "Konzert", "Vorbereiten", "Termin", "Sonstiges"];

export default function SettingsPage() {
  const { data, isAdmin, refresh, session } = useApp();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeed | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [copied, setCopied] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementPending, setAnnouncementPending] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [emailPreferenceError, setEmailPreferenceError] = useState("");
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilterKind[]>([]);

  useEffect(() => {
    const loadedPreferences = loadPreferences();
    setPreferences(loadedPreferences);
    setCalendarFilters(calendarFilterKinds(loadedPreferences));
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    void loadEmailChatPreference();
  }, []);

  async function loadEmailChatPreference() {
    const auth = await supabase?.auth.getSession();
    const token = auth?.data.session?.access_token;
    if (!token) return;
    const response = await fetch("/api/email-preferences", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const result = await response.json() as { emailChatMessages?: boolean; configured?: boolean };
    if (typeof result.configured === "boolean") setEmailConfigured(result.configured);
    if (typeof result.emailChatMessages === "boolean") setPreferences((current) => ({ ...current, emailChatMessages: result.emailChatMessages! }));
  }

  async function updateEmailChatPreference(enabled: boolean) {
    const auth = await supabase?.auth.getSession();
    const token = auth?.data.session?.access_token;
    if (!token) {
      setEmailPreferenceError("Bitte melde dich erneut an, um die E-Mail-Auswahl zu speichern.");
      return;
    }
    const response = await fetch("/api/email-preferences", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ emailChatMessages: enabled }) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setEmailPreferenceError(result.error ?? "E-Mail-Auswahl konnte nicht gespeichert werden.");
      return;
    }
    setEmailPreferenceError("");
    setPreferences((current) => ({ ...current, emailChatMessages: enabled }));
  }

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

  function updateCalendarSelection<K extends "calendarFeedScope" | "calendarFeedEventTypes" | "calendarFeedLocations" | "calendarFeedProfileIds">(key: K, value: AppPreferences[K]) {
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
      body: JSON.stringify({
        eventTypes: preferences.calendarFeedEventTypes,
        locations: preferences.calendarFeedLocations,
        profileIds: preferences.calendarFeedProfileIds,
        scope: preferences.calendarFeedScope
      })
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

  async function publishAnnouncement() {
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();
    if (!title || !message || !session) return;

    setAnnouncementPending(true);
    setAnnouncementError("");
    try {
      await createAnnouncement(title, message, session);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      await refresh();
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Mitteilung konnte nicht gesendet werden.");
    } finally {
      setAnnouncementPending(false);
    }
  }

  async function removeAnnouncement(id: string) {
    try {
      await deleteAnnouncement(id);
      await refresh();
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Mitteilung konnte nicht gelöscht werden.");
    }
  }

  function addCalendarFilter(kind: CalendarFilterKind) {
    setCalendarFilters((current) => current.includes(kind) ? current : [...current, kind]);
    updateCalendarSelection("calendarFeedScope", "types");
  }

  function removeCalendarFilter(kind: CalendarFilterKind) {
    setCalendarFilters((current) => current.filter((item) => item !== kind));
    if (kind === "eventTypes") updateCalendarSelection("calendarFeedEventTypes", []);
    if (kind === "locations") updateCalendarSelection("calendarFeedLocations", []);
    if (kind === "profiles") updateCalendarSelection("calendarFeedProfileIds", []);
  }

  const locationOptions = Array.from(new Set(data.events.map((event) => event.location).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
  const calendarHasFilters = preferences.calendarFeedEventTypes.length + preferences.calendarFeedLocations.length + preferences.calendarFeedProfileIds.length > 0;

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
              <SettingToggle label="Neue Chatnachrichten" description="Zeigt neue Nachrichten des Teams als Gerätehinweis an." checked={preferences.notifyChatMessages} onChange={(checked) => updatePreference("notifyChatMessages", checked)} />
              <SettingToggle label="Chatnachrichten per E-Mail" description="Sende dir eine E-Mail, wenn du eine neue Chatnachricht erhältst. Benötigt die konfigurierte Mailzustellung." checked={preferences.emailChatMessages} onChange={(checked) => void updateEmailChatPreference(checked)} />
              {emailConfigured === false ? <p className="settings-inline-note">E-Mail-Versand ist noch nicht konfiguriert. Der Schalter wird gespeichert, Nachrichten werden bis zur Mailanbieter-Einrichtung aber nicht zugestellt.</p> : null}
              {emailPreferenceError ? <p className="error-text">{emailPreferenceError}</p> : null}
              <SettingToggle label="Fehlende Besetzung" description="Hinweis auf baldige Veranstaltungen, für die noch Leute fehlen." checked={preferences.notifyUnstaffed} onChange={(checked) => updatePreference("notifyUnstaffed", checked)} />
              <SettingToggle label="Erfolge" description="Hinweise bei neuen Meilensteinen im Levelsystem." checked={preferences.notifyAchievements} onChange={(checked) => updatePreference("notifyAchievements", checked)} />
              <div className="setting-toggle setting-fixed"><span><strong>Mitteilungen der Teamleitung</strong><span>Verpflichtende Nachrichten, die von der Teamleitung an alle gesendet werden.</span></span><span className="setting-required"><LockKeyhole size={14} /> Immer aktiv</span></div>
              <SettingToggle label="Neue Anfragen und Vorschläge" description="Neue Formulare, Bewerbungen und Regelvorschläge für Admins." checked={preferences.notifyAdminUpdates} onChange={(checked) => updatePreference("notifyAdminUpdates", checked)} />
            </div>
            <div className="settings-action-row">
              <div><strong>Hinweise auf diesem Gerät</strong><span>{permissionLabel(permission, preferences.browserNotifications)}</span></div>
              <button className={preferences.browserNotifications ? "button danger" : "button primary"} type="button" onClick={() => {
                if (preferences.browserNotifications) {
                  updatePreference("browserNotifications", false);
                } else if (permission === "granted") {
                  updatePreference("browserNotifications", true);
                } else {
                  void enableBrowserNotifications();
                }
              }} disabled={permission === "denied" || permission === "unsupported"}>
                <BellRing size={16} /> {preferences.browserNotifications ? "Deaktivieren" : "Aktivieren"}
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
                <ChoiceButton active={preferences.calendarFeedScope === "types"} label="Mit Filtern" description="Nach Personen, Arten oder Orten zusammenstellen." onClick={() => updateCalendarSelection("calendarFeedScope", "types")} />
              </div>
              {preferences.calendarFeedScope === "types" ? (
                <div className="calendar-filter-builder">
                  <label className="calendar-filter-add"><Filter size={16} /><select value="" onChange={(event) => event.target.value && addCalendarFilter(event.target.value as CalendarFilterKind)}><option value="">Filter hinzufügen...</option>{!calendarFilters.includes("profiles") ? <option value="profiles">Personen</option> : null}{!calendarFilters.includes("eventTypes") ? <option value="eventTypes">Veranstaltungsarten</option> : null}{!calendarFilters.includes("locations") ? <option value="locations">Orte</option> : null}</select></label>
                  {calendarFilters.includes("profiles") ? <CalendarFilterDropdown icon={<UsersRound size={17} />} title="Personen" values={data.profiles.map((profile) => ({ value: profile.id, label: profile.name }))} selected={preferences.calendarFeedProfileIds} onChange={(values) => updateCalendarSelection("calendarFeedProfileIds", values)} onRemove={() => removeCalendarFilter("profiles")} /> : null}
                  {calendarFilters.includes("eventTypes") ? <CalendarFilterDropdown icon={<Tags size={17} />} title="Veranstaltungsarten" values={eventTypeOptions.map((value) => ({ value, label: value }))} selected={preferences.calendarFeedEventTypes} onChange={(values) => updateCalendarSelection("calendarFeedEventTypes", values)} onRemove={() => removeCalendarFilter("eventTypes")} /> : null}
                  {calendarFilters.includes("locations") ? <CalendarFilterDropdown icon={<MapPin size={17} />} title="Orte" values={locationOptions.map((value) => ({ value, label: value }))} selected={preferences.calendarFeedLocations} onChange={(values) => updateCalendarSelection("calendarFeedLocations", values)} onRemove={() => removeCalendarFilter("locations")} /> : null}
                  {!calendarFilters.length ? <p className="calendar-filter-empty">Füge einen Filter hinzu, um deinen Kalender zusammenzustellen.</p> : null}
                </div>
              ) : null}
            </div>
            <div className="calendar-divider" />
            <div className="calendar-subscription">
              <div><strong>Persönlichen Kalender verbinden</strong><span>Apple Kalender und andere Kalender-Apps aktualisieren dieses Abo regelmäßig.</span></div>
              {!calendarFeed ? (
                <button className="button" type="button" onClick={loadCalendarFeed} disabled={preferences.calendarFeedScope === "types" && !calendarHasFilters}>Kalender-Link erstellen</button>
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
                <div><h2>Mitteilung an alle</h2><p>Sende eine Nachricht an alle angemeldeten Teammitglieder.</p></div>
              </header>
              <div className="announcement-composer">
                <label><span>Titel</span><input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Kurze Überschrift" /></label>
                <label><span>Nachricht</span><textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} placeholder="Was sollen alle wissen?" rows={4} /></label>
                {announcementError ? <p className="error-text">{announcementError}</p> : null}
                <button className="button primary" type="button" onClick={() => void publishAnnouncement()} disabled={announcementPending || !announcementTitle.trim() || !announcementMessage.trim()}><Megaphone size={16} /> {announcementPending ? "Wird gesendet..." : "An alle senden"}</button>
              </div>
              {data.announcements.length ? (
                <div className="announcement-list">
                  {data.announcements.map((announcement) => (
                    <article key={announcement.id}>
                      <div><strong>{announcement.title}</strong><p>{announcement.body}</p></div>
                      <button className="icon-button" type="button" aria-label={`${announcement.title} löschen`} onClick={() => void removeAnnouncement(announcement.id)}><Trash2 size={16} /></button>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

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

function CalendarFilterDropdown({ icon, title, values, selected, onChange, onRemove }: { icon: ReactNode; title: string; values: Array<{ value: string; label: string }>; selected: string[]; onChange: (values: string[]) => void; onRemove: () => void }) {
  return <details className="calendar-filter-dropdown"><summary><span>{icon}<strong>{title}</strong></span><span>{selected.length ? `${selected.length} ausgewählt` : "Auswählen"}</span></summary><button className="calendar-filter-remove" type="button" aria-label={`${title}-Filter entfernen`} onClick={onRemove}><X size={15} /></button><div>{values.map((option) => <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} /><span>{option.label}</span><Check size={15} /></label>)}{!values.length ? <p>Keine passenden Einträge vorhanden.</p> : null}</div></details>;
}

function calendarFilterKinds(preferences: AppPreferences): CalendarFilterKind[] {
  const result: CalendarFilterKind[] = [];
  if (preferences.calendarFeedProfileIds.length) result.push("profiles");
  if (preferences.calendarFeedEventTypes.length) result.push("eventTypes");
  if (preferences.calendarFeedLocations.length) result.push("locations");
  return result;
}

function permissionLabel(permission: NotificationPermission | "unsupported", enabled: boolean) {
  if (permission === "granted" && !enabled) return "Hinweise sind auf diesem Gerät pausiert und können jederzeit wieder aktiviert werden.";
  if (permission === "granted") return "Hinweise sind erlaubt. Auf dem iPhone funktioniert das in der Home-Bildschirm-App.";
  if (permission === "denied") return "Im Browser blockiert. Ändere das in den Website-Einstellungen.";
  if (permission === "unsupported") return "Öffne die App auf dem iPhone über das Symbol auf dem Home-Bildschirm.";
  return "Einmalig für diesen Browser oder dieses Gerät freigeben.";
}
