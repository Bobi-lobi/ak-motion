import type { AppData, SessionUser } from "@/lib/types";

export type AppNotification = {
  body: string;
  href: string;
  id: string;
  kind: "achievement" | "admin" | "announcement" | "assignment" | "attention";
  title: string;
};

const achievementSteps = [1, 3, 10, 25, 50, 100];

export function buildNotifications(data: AppData, session: SessionUser | null) {
  if (!session) return [];

  const now = Date.now();
  const notifications: AppNotification[] = data.announcements
    .filter((announcement) => !announcement.expiresAt || new Date(announcement.expiresAt).getTime() > now)
    .map((announcement) => ({
      body: announcement.body,
      href: "/calendar",
      id: `announcement:${announcement.id}`,
      kind: "announcement",
      title: announcement.title
    }));
  const assignedEventIds = new Set(
    data.assignments.filter((assignment) => assignment.profileId === session.id).map((assignment) => assignment.eventId)
  );

  data.events
    .filter((event) => assignedEventIds.has(event.id) && new Date(event.endsAt).getTime() >= now)
    .forEach((event) => {
      const roles = Array.from(new Set(data.assignments
        .filter((assignment) => assignment.eventId === event.id && assignment.profileId === session.id)
        .map((assignment) => assignment.role)));
      notifications.push({
        body: `${formatEventDate(event.startsAt)} · ${roles.join(", ")}`,
        href: "/calendar",
        id: `assignment:${event.id}:${roles.join("-")}`,
        kind: "assignment",
        title: event.title
      });
      const startsAt = new Date(event.startsAt).getTime();
      if (startsAt > now && startsAt <= now + 24 * 60 * 60 * 1000) {
        notifications.push({
          body: `${formatEventDate(event.startsAt)} · Deine Veranstaltung beginnt innerhalb der nächsten 24 Stunden.`,
          href: "/calendar",
          id: `reminder:${event.id}:${event.startsAt}`,
          kind: "assignment",
          title: `Bald: ${event.title}`
        });
      }
    });

  const completedEvents = new Set(data.assignments
    .filter((assignment) => assignment.profileId === session.id)
    .filter((assignment) => {
      const event = data.events.find((item) => item.id === assignment.eventId);
      return event?.status === "Abgeschlossen" && event.eventType.trim().toLowerCase() !== "termin";
    })
    .map((assignment) => assignment.eventId)).size;

  achievementSteps.filter((step) => completedEvents >= step).forEach((step) => notifications.push({
    body: `Du hast ${step} ${step === 1 ? "Veranstaltung" : "Veranstaltungen"} betreut.`,
    href: "/rankings",
    id: `achievement:events:${step}`,
    kind: "achievement",
    title: step === 1 ? "Der erste Einsatz" : `${step} Einsätze erreicht`
  }));

  if (session.role === "admin") {
    data.requests.filter((request) => request.status === "pending").forEach((request) => notifications.push({
      body: `${request.contactName} hat eine neue Veranstaltung angefragt.`, href: "/requests", id: `request:${request.id}`, kind: "admin", title: request.title
    }));
    data.registrationRequests.filter((request) => request.status === "pending").forEach((request) => notifications.push({
      body: `${request.name} wartet auf die Freischaltung.`, href: "/team", id: `registration:${request.id}`, kind: "admin", title: "Neue Bewerbung"
    }));
    data.knowledgeSuggestions.filter((suggestion) => suggestion.pageId === "rules").forEach((suggestion) => notifications.push({
      body: `${suggestion.authorName} hat eine Änderung vorgeschlagen.`, href: "/rules", id: `rules-suggestion:${suggestion.id}`, kind: "admin", title: "Neuer Regelvorschlag"
    }));
    data.events
      .filter((event) => {
        const startsAt = new Date(event.startsAt).getTime();
        return startsAt >= now && startsAt <= now + 30 * 24 * 60 * 60 * 1000 && !isStaffed(event.id, event.eventType, data);
      })
      .forEach((event) => notifications.push({
        body: `${formatEventDate(event.startsAt)} · Es fehlt noch eine Einteilung.`, href: "/calendar", id: `unstaffed:${event.id}`, kind: "attention", title: event.title
      }));
  }

  return notifications;
}

function isStaffed(eventId: string, eventType: string, data: AppData) {
  const roles = data.assignments.filter((assignment) => assignment.eventId === eventId).map((assignment) => assignment.role);
  if (eventType.trim().toLowerCase() === "termin") return roles.includes("Teilnehmer");
  if (eventType.trim().toLowerCase() === "schulische veranstaltung") return roles.includes("Ton");
  return roles.includes("Ton") && roles.includes("Licht");
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(value));
}
