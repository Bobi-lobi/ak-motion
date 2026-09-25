import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

function emailPreferenceError(error: unknown, action: string) {
  if (error instanceof Response) {
    return NextResponse.json({ error: error.status === 500 ? "Die serverseitige Supabase-Admin-Verbindung ist nicht konfiguriert." : "Bitte melde dich erneut an." }, { status: error.status });
  }
  const details = typeof error === "object" && error !== null
    ? error as { code?: unknown; message?: unknown }
    : {};
  const code = typeof details.code === "string" ? details.code : "";
  if (code === "42P01") {
    console.error(`E-Mail-Präferenz konnte nicht ${action} werden: Tabelle fehlt in PostgreSQL.`, error);
    return NextResponse.json({ error: `Die Tabelle fehlt tatsächlich in der Datenbank (${code}). Die Migration 20260925103000_chat_groups_email_preferences.sql muss auf der von der App verwendeten Datenbank eingespielt werden.` }, { status: 503 });
  }
  if (code === "PGRST205") {
    console.error(`E-Mail-Präferenz konnte nicht ${action} werden: Tabelle fehlt im PostgREST-Schema-Cache.`, error);
    return NextResponse.json({ error: `Die Tabelle ist für die Supabase-API nicht im Schema sichtbar (${code}). Die Migration wurde möglicherweise bereits ausgeführt; dann muss der PostgREST-Schema-Cache der NAS-Instanz neu geladen werden.` }, { status: 503 });
  }
  if (code === "PGRST204") {
    console.error(`E-Mail-Präferenz konnte nicht ${action} werden: Spalte fehlt im PostgREST-Schema-Cache.`, error);
    return NextResponse.json({ error: `Die Supabase-API hat einen veralteten Schema-Cache (${code}). Die Datenbankmigration ist nicht zwingend fehlend; der PostgREST-Schema-Cache muss neu geladen werden.` }, { status: 503 });
  }
  if (code === "42501") {
    return NextResponse.json({ error: "Supabase verweigert den Datenbankzugriff. Bitte prüfe den SUPABASE_SERVICE_ROLE_KEY in Vercel." }, { status: 503 });
  }
  console.error(`E-Mail-Präferenz konnte nicht ${action} werden:`, error);
  return NextResponse.json({ error: `E-Mail-Auswahl konnte nicht ${action} werden${code ? ` (Supabase-Fehler ${code})` : ""}.` }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const { data, error } = await supabaseAdmin!.from("email_notification_preferences").select("chat_messages").eq("profile_id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ emailChatMessages: data?.chat_messages ?? false, configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) });
  } catch (error) {
    return emailPreferenceError(error, "geladen");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = await request.json() as { emailChatMessages?: boolean };
    if (typeof body.emailChatMessages !== "boolean") return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400 });
    const { error } = await supabaseAdmin!.from("email_notification_preferences").upsert({ profile_id: user.id, chat_messages: body.emailChatMessages, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
    if (error) throw error;
    return NextResponse.json({ emailChatMessages: body.emailChatMessages });
  } catch (error) {
    return emailPreferenceError(error, "gespeichert");
  }
}
