import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AppData, SessionUser } from "@/lib/types";

type EmailChoice = {
  enabled: boolean;
  new_events: boolean;
  assignments: boolean;
  unstaffed: boolean;
  achievements: boolean;
  admin_updates: boolean;
  announcements: boolean;
};

const minimumCreatedAt = new Date("2026-09-27T00:00:00Z").getTime();

function must<T>(result: { data: T; error: { message: string } | null }, name: string): T {
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

function selected(notification: AppNotification, choice: EmailChoice) {
  if (!choice.enabled) return false;
  if (notification.kind === "event") return choice.new_events;
  if (notification.kind === "assignment") return choice.assignments;
  if (notification.kind === "attention") return choice.unstaffed;
  if (notification.kind === "achievement") return choice.achievements;
  if (notification.kind === "announcement") return choice.announcements;
  if (notification.kind === "admin") return choice.admin_updates;
  return false;
}

export async function dispatchNonChatEmails(origin: string) {
  if (!supabaseAdmin) throw new Error("Supabase Admin ist nicht konfiguriert.");
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Brevo ist nicht konfiguriert.");

  const [profilesResult, preferencesResult, eventsResult, assignmentsResult, announcementsResult, requestsResult, registrationsResult, suggestionsResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name, email, role"),
    supabaseAdmin.from("email_notification_preferences").select("profile_id, enabled, new_events, assignments, unstaffed, achievements, admin_updates, announcements"),
    supabaseAdmin.from("events").select("id, title, starts_at, ends_at, event_type, status, created_at"),
    supabaseAdmin.from("event_assignments").select("id, event_id, profile_id, role, created_at"),
    supabaseAdmin.from("announcements").select("id, title, body, created_at, expires_at"),
    supabaseAdmin.from("event_requests").select("id, title, contact_name, status, created_at"),
    supabaseAdmin.from("registration_requests").select("id, name, status, created_at"),
    supabaseAdmin.from("knowledge_suggestions").select("id, page_id, author_name, created_at")
  ]);

  const profiles = must(profilesResult, "Profile") ?? [];
  const preferences = must(preferencesResult, "E-Mail-Einstellungen") ?? [];
  const events = must(eventsResult, "Veranstaltungen") ?? [];
  const assignments = must(assignmentsResult, "Einteilungen") ?? [];
  const announcements = must(announcementsResult, "Mitteilungen") ?? [];
  const requests = must(requestsResult, "Anfragen") ?? [];
  const registrations = must(registrationsResult, "Bewerbungen") ?? [];
  const suggestions = must(suggestionsResult, "Vorschläge") ?? [];

  const data = {
    announcements: announcements.map((row) => ({ id: row.id, title: row.title, body: row.body, expiresAt: row.expires_at, createdAt: row.created_at })),
    events: events.map((row) => ({ id: row.id, title: row.title, startsAt: row.starts_at, endsAt: row.ends_at, eventType: row.event_type, status: row.status, createdAt: row.created_at })),
    assignments: assignments.map((row) => ({ id: row.id, eventId: row.event_id, profileId: row.profile_id, role: row.role, createdAt: row.created_at })),
    requests: requests.map((row) => ({ id: row.id, title: row.title, contactName: row.contact_name, status: row.status, createdAt: row.created_at })),
    registrationRequests: registrations.map((row) => ({ id: row.id, name: row.name, status: row.status, createdAt: row.created_at })),
    knowledgeSuggestions: suggestions.map((row) => ({ id: row.id, pageId: row.page_id, authorName: row.author_name, createdAt: row.created_at }))
  } as unknown as AppData;

  const preferenceById = new Map(preferences.map((row) => [row.profile_id, row]));
  const announcementDate = new Map(announcements.map((row) => [row.id, new Date(row.created_at).getTime()]));
  const assignmentDate = new Map<string, number>();
  for (const row of assignments) {
    const key = `${row.profile_id}:${row.event_id}:${row.role}`;
    assignmentDate.set(key, new Date(row.created_at).getTime());
  }
  const eventById = new Map(events.map((row) => [row.id, row]));
  const requestDate = new Map(requests.map((row) => [row.id, new Date(row.created_at).getTime()]));
  const registrationDate = new Map(registrations.map((row) => [row.id, new Date(row.created_at).getTime()]));
  const suggestionDate = new Map(suggestions.map((row) => [row.id, new Date(row.created_at).getTime()]));
  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;
    const choice = preferenceById.get(profile.id) ?? { enabled: false, new_events: false, assignments: false, unstaffed: false, achievements: false, admin_updates: false, announcements: true };
    const user = { id: profile.id, email: profile.email, name: profile.name, role: profile.role } as SessionUser;
    const notifications = buildNotifications(data, user).filter((item) => selected(item, choice));
    for (const notification of notifications) {
      const [category, id] = notification.id.split(":", 2);
      const createdAt = category === "event" ? new Date(eventById.get(id)?.created_at ?? 0).getTime()
        : category === "announcement" ? announcementDate.get(id)
        : category === "request" ? requestDate.get(id)
        : category === "registration" ? registrationDate.get(id)
        : category === "rules-suggestion" ? suggestionDate.get(id) : undefined;
      if (createdAt !== undefined && createdAt < minimumCreatedAt) continue;
      if (category === "assignment") {
        const eventAssignments = assignments.filter((row) => row.profile_id === profile.id && row.event_id === id);
        if (!eventAssignments.some((row) => (assignmentDate.get(`${row.profile_id}:${row.event_id}:${row.role}`) ?? 0) >= minimumCreatedAt)) continue;
      }
      if (category === "achievement") {
        const recentCompleted = assignments.some((row) => {
          if (row.profile_id !== profile.id) return false;
          const event = eventById.get(row.event_id);
          return event?.status === "Abgeschlossen" && new Date(event.ends_at).getTime() >= minimumCreatedAt;
        });
        if (!recentCompleted) continue;
      }

      const { error: reservationError } = await supabaseAdmin.from("notification_email_deliveries")
        .insert({ profile_id: profile.id, notification_id: notification.id, sent_at: null });
      if (reservationError?.code === "23505") {
        const { data: previous, error: previousError } = await supabaseAdmin.from("notification_email_deliveries")
          .select("sent_at, attempted_at").eq("profile_id", profile.id).eq("notification_id", notification.id).maybeSingle();
        if (previousError) throw previousError;
        if (previous?.sent_at || !previous?.attempted_at || Date.now() - new Date(previous.attempted_at).getTime() < 5 * 60 * 1000) continue;
        const { error: cleanupError } = await supabaseAdmin.from("notification_email_deliveries")
          .delete().eq("profile_id", profile.id).eq("notification_id", notification.id).eq("attempted_at", previous.attempted_at);
        if (cleanupError) throw cleanupError;
        const { error: retryError } = await supabaseAdmin.from("notification_email_deliveries")
          .insert({ profile_id: profile.id, notification_id: notification.id, sent_at: null });
        if (retryError?.code === "23505") continue;
        if (retryError) throw retryError;
      }
      if (reservationError) throw reservationError;
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: process.env.BREVO_FROM_NAME || "AK-Motion" },
            to: [{ email: profile.email }],
            subject: `Neuer Hinweis in AK-Motion: ${notification.kind === "announcement" ? "Teamleitung" : notification.kind === "event" ? "Veranstaltung" : notification.kind === "assignment" ? "Einteilung oder Erinnerung" : notification.kind === "attention" ? "Besetzung" : notification.kind === "achievement" ? "Erfolg" : "Anfrage"}`,
            textContent: `In AK-Motion gibt es einen neuen Hinweis für dich.\n\nÖffne die App, um ihn zu lesen: ${origin}${notification.href}`
          })
        });
        if (!response.ok) throw new Error(`Brevo HTTP ${response.status}`);
        const { error: recordedError } = await supabaseAdmin.from("notification_email_deliveries")
          .update({ sent_at: new Date().toISOString() }).eq("profile_id", profile.id).eq("notification_id", notification.id);
        if (recordedError) throw recordedError;
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error("Hinweis-E-Mail fehlgeschlagen:", notification.id, error);
        await supabaseAdmin.from("notification_email_deliveries").delete().eq("profile_id", profile.id).eq("notification_id", notification.id);
      }
    }
  }
  return { sent, failed };
}
