import { NextResponse } from "next/server";
import { createCalendarFeedToken } from "@/lib/calendar-feed";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
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
  const token = createCalendarFeedToken(data.user.id);
  const url = new URL(`/api/calendar-feed/${token}`, request.url).toString();
  return NextResponse.json({ url, webcalUrl: url.replace(/^https?:\/\//, "webcal://") });
}
