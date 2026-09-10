import { NextResponse } from "next/server";
import { createCalendarFeedToken, type CalendarFeedScope } from "@/lib/calendar-feed";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Kalender-Feed ist nicht konfiguriert." }, { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: "Sitzung konnte nicht geprüft werden." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { eventTypes?: unknown; locations?: unknown; profileIds?: unknown; scope?: unknown };
  const scope: CalendarFeedScope = body.scope === "all" || body.scope === "types" ? body.scope : "assigned";
  const eventTypes = Array.isArray(body.eventTypes) ? body.eventTypes.filter((value): value is string => typeof value === "string").slice(0, 20) : [];
  const locations = Array.isArray(body.locations) ? body.locations.filter((value): value is string => typeof value === "string").slice(0, 50) : [];
  const profileIds = Array.isArray(body.profileIds) ? body.profileIds.filter((value): value is string => typeof value === "string").slice(0, 100) : [];
  const token = createCalendarFeedToken({ eventTypes, locations, profileIds, scope, userId: data.user.id });
  const url = new URL(`/api/calendar-feed/${token}`, request.url).toString();
  return NextResponse.json({ url, webcalUrl: url.replace(/^https?:\/\//, "webcal://") });
}
