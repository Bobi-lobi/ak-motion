import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const { data, error } = await supabaseAdmin!.from("email_notification_preferences").select("chat_messages").eq("profile_id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ emailChatMessages: data?.chat_messages ?? false, configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "E-Mail-Auswahl konnte nicht geladen werden." }, { status: 500 });
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
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "E-Mail-Auswahl konnte nicht gespeichert werden." }, { status: 500 });
  }
}
