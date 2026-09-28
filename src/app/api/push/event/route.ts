import { NextResponse } from "next/server";
import webpush from "web-push";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const { eventId } = await request.json() as { eventId?: string };
    if (!eventId) return NextResponse.json({ error: "Veranstaltung fehlt." }, { status: 400 });
    const { data: event, error: eventError } = await supabaseAdmin!.from("events")
      .select("id, title, created_by, created_at").eq("id", eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event || event.created_by !== user.id || Date.now() - new Date(event.created_at).getTime() > 10 * 60 * 1000) {
      return NextResponse.json({ error: "Veranstaltung nicht gefunden." }, { status: 404 });
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return NextResponse.json({ configured: false, sent: 0 });
    const { error: reservationError } = await supabaseAdmin!.from("event_push_deliveries").insert({ event_id: event.id });
    if (reservationError?.code === "23505") return NextResponse.json({ configured: true, sent: 0, duplicate: true });
    if (reservationError) throw reservationError;
    const { data: profiles, error: profilesError } = await supabaseAdmin!.from("profiles").select("id").neq("id", user.id);
    if (profilesError) throw profilesError;
    const recipientIds = (profiles ?? []).map((profile) => profile.id);
    if (!recipientIds.length) return NextResponse.json({ configured: true, sent: 0 });
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin!.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth").eq("new_events_enabled", true).in("profile_id", recipientIds);
    if (subscriptionsError) throw subscriptionsError;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@simonpaulitsch.de", publicKey, privateKey);
    const payload = JSON.stringify({ title: "Neue Veranstaltung", body: "Eine neue Veranstaltung wurde eingetragen.", href: `/calendar?event=${encodeURIComponent(event.id)}`, icon: "/ak-motion-logo.png", tag: `event:${event.id}` });
    const results = await Promise.allSettled((subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { auth: subscription.auth, p256dh: subscription.p256dh } }, payload);
        return true;
      } catch (error) {
        const code = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (code === 404 || code === 410) {
          await supabaseAdmin!.from("push_subscriptions").delete().eq("id", subscription.id);
          return false;
        }
        throw error;
      }
    }));
    const sent = results.filter((result) => result.status === "fulfilled" && result.value).length;
    return NextResponse.json({ configured: true, sent, failed: results.length - sent });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Veranstaltungs-Push fehlgeschlagen:", error);
    return NextResponse.json({ error: "Veranstaltungs-Hinweis fehlgeschlagen." }, { status: 500 });
  }
}
