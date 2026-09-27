import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const sender = await requireUserFromRequest(request);
    const { messageId } = await request.json() as { messageId?: string };
    if (!messageId) return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
    const { data: message, error: messageError } = await supabaseAdmin!.from("chat_messages").select("id, author_id, conversation_id").eq("id", messageId).maybeSingle();
    if (messageError) {
      console.error("Chat-E-Mail: Nachricht konnte nicht gelesen werden:", messageError);
      return NextResponse.json({ error: messageError.code === "42501"
        ? "Der Server hat noch keinen Zugriff auf Chatnachrichten. Bitte die Migration 20260927200000_chat_notification_service_role_access.sql auf dem NAS ausführen."
        : `Die Chatnachricht konnte nicht geprüft werden (${messageError.code}).` }, { status: 503 });
    }
    if (!message || message.author_id !== sender.id) {
      console.warn("Chat-E-Mail: Nachricht fehlt oder Absender stimmt nicht", { messageId, found: Boolean(message), senderMatches: message?.author_id === sender.id });
      return NextResponse.json({ error: "Nachricht wurde nicht gefunden." }, { status: 404 });
    }
    const { data: members, error: membersError } = await supabaseAdmin!.from("chat_conversation_members").select("profile_id").eq("conversation_id", message.conversation_id).neq("profile_id", sender.id);
    if (membersError) throw membersError;
    const memberIds = (members ?? []).map((member) => member.profile_id);
    if (!memberIds.length) {
      console.info("Chat-E-Mail: keine weiteren Chatmitglieder", { messageId });
      return NextResponse.json({ configured: true, sent: 0 });
    }
    const [{ data: preferences, error: preferencesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabaseAdmin!.from("email_notification_preferences").select("profile_id").eq("chat_messages", true).in("profile_id", memberIds),
      supabaseAdmin!.from("profiles").select("id, email").in("id", memberIds)
    ]);
    if (preferencesError) throw preferencesError;
    if (profilesError) throw profilesError;
    const recipients = (profiles ?? []).filter((profile) => preferences?.some((preference) => preference.profile_id === profile.id)).map((profile) => profile.email).filter(Boolean);
    if (!recipients.length) {
      console.info("Chat-E-Mail: keine Empfänger mit aktivierter E-Mail-Auswahl", { messageId, members: memberIds.length });
      return NextResponse.json({ configured: true, sent: 0 });
    }
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.BREVO_FROM_EMAIL;
    if (!apiKey || !from) {
      console.error("Chat-E-Mail: Brevo-Konfiguration fehlt", { messageId, hasApiKey: Boolean(apiKey), hasFrom: Boolean(from) });
      return NextResponse.json({ configured: false, sent: 0 });
    }
    let sent = 0;
    for (const recipient of recipients) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: process.env.BREVO_FROM_NAME || "AK-Motion" },
          to: [{ email: recipient }],
          subject: "Neue Chatnachricht in AK-Motion",
          textContent: `Du hast eine neue Nachricht in AK-Motion.\n\nMelde dich in der App an, um sie zu lesen: ${new URL(request.url).origin}/chat`
        })
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("Brevo meldet einen E-Mail-Versandfehler:", response.status, detail.slice(0, 300));
        return NextResponse.json({ error: "Mindestens eine E-Mail konnte nicht versendet werden.", sent }, { status: 502 });
      }
      sent += 1;
    }
    console.info("Chat-E-Mail: von Brevo angenommen", { messageId, sent });
    return NextResponse.json({ configured: true, sent });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Chat-E-Mail konnte nicht versendet werden:", error);
    return NextResponse.json({ error: "Chat-E-Mail konnte nicht versendet werden." }, { status: 500 });
  }
}
