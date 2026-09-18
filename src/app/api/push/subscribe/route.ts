import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { auth?: string; p256dh?: string };
};

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = (await request.json()) as SubscriptionBody;
    if (!body.endpoint || !body.keys?.auth || !body.keys.p256dh) {
      return NextResponse.json({ error: "Die Push-Anmeldung ist unvollständig." }, { status: 400 });
    }
    const { error } = await supabaseAdmin!.from("push_subscriptions").upsert({
      profile_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push-Anmeldung fehlgeschlagen." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) return NextResponse.json({ ok: true });
    const { error } = await supabaseAdmin!.from("push_subscriptions").delete().eq("profile_id", user.id).eq("endpoint", body.endpoint);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push-Abmeldung fehlgeschlagen." }, { status: 500 });
  }
}
