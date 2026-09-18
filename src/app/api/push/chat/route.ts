import { NextResponse } from "next/server";
import webpush from "web-push";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const { messageId } = (await request.json()) as { messageId?: string };
    if (!messageId) return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@simonpaulitsch.de";
    if (!publicKey || !privateKey) return NextResponse.json({ configured: false, sent: 0 });

    const [{ data: message, error: messageError }, { data: profile, error: profileError }] = await Promise.all([
      supabaseAdmin!.from("chat_messages").select("id, author_id, conversation_id, body, attachments, chat_conversations(name)").eq("id", messageId).maybeSingle(),
      supabaseAdmin!.from("profiles").select("name").eq("id", user.id).maybeSingle()
    ]);
    if (messageError || !message || message.author_id !== user.id) return NextResponse.json({ error: "Nachricht wurde nicht gefunden." }, { status: 404 });
    if (profileError) throw profileError;
    const { data: members, error: memberError } = await supabaseAdmin!.from("chat_conversation_members").select("profile_id").eq("conversation_id", message.conversation_id).neq("profile_id", user.id);
    if (memberError) throw memberError;
    const memberIds = (members ?? []).map((member) => member.profile_id);
    const { data: subscriptions, error: subscriptionError } = memberIds.length
      ? await supabaseAdmin!.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("profile_id", memberIds)
      : { data: [], error: null };
    if (subscriptionError) throw subscriptionError;

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const relatedConversation = message.chat_conversations as unknown as { name?: string } | { name?: string }[] | null;
    const conversationName = (Array.isArray(relatedConversation) ? relatedConversation[0]?.name : relatedConversation?.name) ?? "Chat";
    const payload = JSON.stringify({
      body: message.body?.trim() || (attachments.length ? "Hat ein Bild oder eine Datei gesendet." : "Neue Nachricht"),
      href: "/chat",
      icon: "/ak-motion-logo.png",
      tag: `chat:${message.id}`,
      title: `${profile?.name ?? "Ein Teammitglied"} · ${conversationName}`
    });
    const results = await Promise.allSettled((subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { auth: subscription.auth, p256dh: subscription.p256dh } }, payload);
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await supabaseAdmin!.from("push_subscriptions").delete().eq("id", subscription.id);
        else throw error;
      }
    }));
    return NextResponse.json({ configured: true, sent: results.filter((result) => result.status === "fulfilled").length });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push-Nachricht fehlgeschlagen." }, { status: 500 });
  }
}
