import { NextResponse } from "next/server";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = await request.json() as { name?: unknown; phone?: unknown; avatarUrl?: unknown };
    const updates: { name?: string; phone?: string; avatar_url?: string } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
        return NextResponse.json({ error: "Der Name muss zwischen 1 und 100 Zeichen lang sein." }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if (body.phone !== undefined) {
      if (typeof body.phone !== "string" || body.phone.length > 40) {
        return NextResponse.json({ error: "Die Telefonnummer ist ungültig." }, { status: 400 });
      }
      updates.phone = body.phone.trim();
    }
    if (body.avatarUrl !== undefined) {
      if (typeof body.avatarUrl !== "string" || (body.avatarUrl && !/^https:\/\//i.test(body.avatarUrl))) {
        return NextResponse.json({ error: "Die Profilbild-Adresse ist ungültig." }, { status: 400 });
      }
      updates.avatar_url = body.avatarUrl;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "Keine Profiländerungen übermittelt." }, { status: 400 });

    const { error } = await supabaseAdmin!.from("profiles").update(updates).eq("id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Profil konnte nicht aktualisiert werden:", error);
    return NextResponse.json({ error: "Profil konnte nicht gespeichert werden." }, { status: 500 });
  }
}
