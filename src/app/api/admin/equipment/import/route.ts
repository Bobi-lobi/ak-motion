import { NextResponse } from "next/server";
import equipmentCatalog from "@/data/equipment-catalog.json";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

const CATALOG_NAMESPACE = "equipment_catalog";
const CATALOG_VERSION = "notion-2026-09-10-v1";

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);

    const { data: marker, error: markerError } = await supabaseAdmin!
      .from("app_options")
      .select("id")
      .eq("namespace", CATALOG_NAMESPACE)
      .eq("label", CATALOG_VERSION)
      .maybeSingle();
    if (markerError) {
      return NextResponse.json({ error: markerError.message }, { status: 400 });
    }
    if (marker) {
      return NextResponse.json({ imported: false, count: equipmentCatalog.length });
    }

    const { error: deleteItemsError } = await supabaseAdmin!
      .from("equipment_items")
      .delete()
      .not("id", "is", null);
    if (deleteItemsError) {
      return NextResponse.json({ error: deleteItemsError.message }, { status: 400 });
    }

    const { error: insertError } = await supabaseAdmin!
      .from("equipment_items")
      .insert(equipmentCatalog.map((item) => ({ ...item, updated_at: new Date().toISOString() })));
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const tags = [
      ...new Set(equipmentCatalog.map((item) => item.type).filter(Boolean))
    ].map((label) => ({ column_id: "type", label, color: tagColor(label, "type") }));
    tags.push(...[
      ...new Set(equipmentCatalog.map((item) => item.state).filter(Boolean))
    ].map((label) => ({ column_id: "state", label, color: tagColor(label, "state") })));

    const { error: tagsError } = await supabaseAdmin!
      .from("equipment_tags")
      .upsert(tags, { onConflict: "column_id,label" });
    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 400 });
    }

    const { error: versionError } = await supabaseAdmin!.from("app_options").insert({
      namespace: CATALOG_NAMESPACE,
      label: CATALOG_VERSION
    });
    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 400 });
    }

    return NextResponse.json({ imported: true, count: equipmentCatalog.length });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json({ error: "Equipment konnte nicht importiert werden." }, { status: 500 });
  }
}

function tagColor(value: string, columnId: "type" | "state") {
  if (columnId === "state") {
    if (value === "Einwandfrei" || value === "Voll") return "#3f765c";
    if (value === "Kaputt" || value === "Nicht verwenden") return "#7d4a48";
    return "#4a4a45";
  }

  const palette = ["#765842", "#69558a", "#5f708d", "#7d6f3c", "#3f765c", "#4a4a45"];
  const hash = Array.from(value).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
