import { NextResponse } from "next/server";
import { escapeIcs, icsDate, readCalendarFeedToken } from "@/lib/calendar-feed";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    if (!supabaseAdmin) {
      return new NextResponse("Kalender-Feed ist nicht konfiguriert.", { status: 500 });
    }
    const { token } = await context.params;
    const selection = readCalendarFeedToken(token);
    if (!selection) {
      return new NextResponse("Ungültiger Kalender-Link.", { status: 401 });
    }
    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("event_assignments")
      .select("event_id, role")
      .eq("profile_id", selection.userId);
    if (assignmentError) {
      throw assignmentError;
    }
    const eventIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.event_id)));
    let filteredProfileEventIds: string[] | null = null;
    if (selection.scope === "types" && selection.profileIds.length) {
      const { data: filteredAssignments, error: filteredAssignmentError } = await supabaseAdmin
        .from("event_assignments")
        .select("event_id")
        .in("profile_id", selection.profileIds);
      if (filteredAssignmentError) throw filteredAssignmentError;
      filteredProfileEventIds = Array.from(new Set((filteredAssignments ?? []).map((assignment) => assignment.event_id)));
    }
    let eventQuery = supabaseAdmin
      .from("events")
      .select("id, title, starts_at, ends_at, location, notes, created_at, event_type")
      .order("starts_at", { ascending: true });
    if (selection.scope === "assigned") {
      if (!eventIds.length) {
        eventQuery = eventQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        eventQuery = eventQuery.in("id", eventIds);
      }
    } else if (selection.scope === "types") {
      if (selection.eventTypes.length) eventQuery = eventQuery.in("event_type", selection.eventTypes);
      if (selection.locations.length) eventQuery = eventQuery.in("location", selection.locations);
      if (filteredProfileEventIds !== null) {
        eventQuery = eventQuery.in("id", filteredProfileEventIds.length ? filteredProfileEventIds : ["00000000-0000-0000-0000-000000000000"]);
      }
      if (!selection.eventTypes.length && !selection.locations.length && filteredProfileEventIds === null) {
        eventQuery = eventQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
      }
    }
    const { data: events, error: eventError } = await eventQuery;
    if (eventError) {
      throw eventError;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AK-Motion//Persoenlicher Kalender//DE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:AK-Motion"
    ];
    (events ?? []).forEach((event) => {
      const roles = (assignments ?? []).filter((assignment) => assignment.event_id === event.id).map((assignment) => assignment.role);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}@ak-motion`,
        `DTSTAMP:${icsDate(event.created_at)}`,
        `DTSTART:${icsDate(event.starts_at)}`,
        `DTEND:${icsDate(event.ends_at)}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `LOCATION:${escapeIcs(event.location ?? "")}`,
        `DESCRIPTION:${escapeIcs([roles.length ? `Rolle: ${roles.join(", ")}` : "", event.notes ?? ""].filter(Boolean).join("\n"))}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return new NextResponse(`${lines.join("\r\n")}\r\n`, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline; filename=ak-motion.ics",
        "Content-Type": "text/calendar; charset=utf-8"
      }
    });
  } catch (error) {
    console.error("Kalender-Feed konnte nicht erstellt werden:", error);
    return new NextResponse("Kalender konnte nicht erstellt werden.", { status: 500 });
  }
}
