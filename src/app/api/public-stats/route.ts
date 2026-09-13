import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ events: 0, technicians: 0, equipment: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const [eventsResult, techniciansResult, equipmentResult] = await Promise.all([
    supabaseAdmin.from("events").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("equipment_items").select("id", { count: "exact", head: true })
  ]);
  const error = eventsResult.error ?? techniciansResult.error ?? equipmentResult.error;

  if (error) {
    return NextResponse.json({ error: "Startseiten-Zähler konnten nicht geladen werden." }, { status: 500 });
  }

  return NextResponse.json(
    {
      events: eventsResult.count ?? 0,
      technicians: techniciansResult.count ?? 0,
      equipment: equipmentResult.count ?? 0
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
