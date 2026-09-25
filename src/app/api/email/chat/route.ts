import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const sender = await requireUserFromRequest(request);
    const { messageId } = await request.json() as { messageId?: string };
    if (!messageId) return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
    const { data: message, error: messageError } = await supabaseAdmin!.from("chat_messages").select("id, author_id, conversation_id, body, attachments, chat_conversations(name)").eq("id", messageId).maybeSingle();
    if (messageError || !message || message.author_id !== sender.id) return NextResponse.json({ error: "Nachricht wurde nicht gefunden." }, { status: 404 });
    const conversationJoin = message.chat_conversations as unknown as { name?: string } | { name?: string }[] | null;
    const conversationName = (Array.isArray(conversationJoin) ? conversationJoin[0]?.name : conversationJoin?.name) ?? "Chat";
    const [{ data: members, error: membersError }, { data: senderProfile }] = await Promise.all([
      supabaseAdmin!.from("chat_conversation_members").select("profile_id").eq("conversation_id", message.conversation_id).neq("profile_id", sender.id),
      supabaseAdmin!.from("profiles").select("name").eq("id", sender.id).maybeSingle()
    ]);
    if (membersError) throw membersError;
    const memberIds = (members ?? []).map((member) => member.profile_id);
    if (!memberIds.length) return NextResponse.json({ configured: true, sent: 0 });
    const [{ data: preferences, error: preferencesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabaseAdmin!.from("email_notification_preferences").select("profile_id").eq("chat_messages", true).in("profile_id", memberIds),
      supabaseAdmin!.from("profiles").select("id, email").in("id", memberIds)
    ]);
    if (preferencesError) throw preferencesError;
    if (profilesError) throw profilesError;
    const recipients = (profiles ?? []).filter((profile) => preferences?.some((preference) => preference.profile_id === profile.id)).map((profile) => profile.email).filter(Boolean);
    if (!recipients.length) return NextResponse.json({ configured: true, sent: 0 });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return NextResponse.json({ configured: false, sent: 0 });
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const body = message.body?.trim() || (attachments.length ? "Hat ein Bild oder eine Datei gesendet." : "Neue Nachricht");
    let sent = 0;
    for (const recipient of recipients) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: recipient,
          subject: `${senderProfile?.name ?? "Teammitglied"} in ${conversationName}`,
          text: `${senderProfile?.name ?? "Ein Teammitglied"} hat im Chat „${conversationName}“ geschrieben:\n\n${body}\n\nIn AK-Motion öffnen: ${new URL(request.url).origin}/chat`
        })
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("E-Mail-Versanddienst meldet einen Fehler:", response.status, detail.slice(0, 300));
        return NextResponse.json({ error: "Mindestens eine E-Mail konnte nicht versendet werden.", sent }, { status: 502 });
      }
      sent += 1;
    }
    return NextResponse.json({ configured: true, sent });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Chat-E-Mail konnte nicht versendet werden:", error);
    return NextResponse.json({ error: "Chat-E-Mail konnte nicht versendet werden." }, { status: 500 });
  }
}
