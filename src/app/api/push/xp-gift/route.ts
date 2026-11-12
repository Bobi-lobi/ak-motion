import { NextResponse } from "next/server";
import webpush from "web-push";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminFromRequest(request);
    const { awardId } = await request.json();
    if (typeof awardId !== "string" || !/^[\da-f-]{36}$/i.test(awardId)) return NextResponse.json({ error: "Punktevergabe fehlt." }, { status: 400 });
    const db = supabaseAdmin!;
    const { data: award, error: awardError } = await db.from("xp_awards")
      .select("id, profile_id, amount, created_by, created_at, reason").eq("id", awardId).maybeSingle();
    if (awardError) throw awardError;
    if (!award || award.created_by !== admin.id || !award.reason.startsWith("gift:") || Date.now() - new Date(award.created_at).getTime() > 10 * 60 * 1000) {
      return NextResponse.json({ error: "Aktuelles Punktegeschenk nicht gefunden." }, { status: 404 });
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return NextResponse.json({ configured: false, sent: 0 });
    const [{ data: profile, error: profileError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      db.from("profiles").select("name").eq("id", admin.id).single(),
      db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", award.profile_id).eq("achievements_enabled", true)
    ]);
    if (profileError || subscriptionError) throw profileError || subscriptionError;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@simonpaulitsch.de", publicKey, privateKey);
    const payload = JSON.stringify({ title: "Ein Punktegeschenk für dich", body: `${profile.name} hat dir ${award.amount} Punkte geschenkt.`, href: "/chat", icon: "/ak-motion-logo.png", tag: `xp-gift:${award.id}` });
    const results = await Promise.allSettled((subscriptions ?? []).map(async (subscription) => {
      const reservation = { award_id: award.id, subscription_id: subscription.id };
      const { error } = await db.from("xp_gift_push_deliveries").insert(reservation);
      if (error?.code === "23505") return false;
      if (error) throw error;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { auth: subscription.auth, p256dh: subscription.p256dh } }, payload);
        return true;
      } catch (error) {
        await db.from("xp_gift_push_deliveries").delete().eq("award_id", award.id).eq("subscription_id", subscription.id);
        const code = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (code === 404 || code === 410) { await db.from("push_subscriptions").delete().eq("id", subscription.id); return false; }
        throw error;
      }
    }));
    return NextResponse.json({ configured: true, sent: results.filter((result) => result.status === "fulfilled" && result.value).length, failed: results.filter((result) => result.status === "rejected").length });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Punktegeschenk-Hinweis fehlgeschlagen:", error);
    return NextResponse.json({ error: "Gerätehinweis konnte nicht versendet werden." }, { status: 500 });
  }
}
