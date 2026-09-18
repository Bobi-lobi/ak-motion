import { NextResponse } from "next/server";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireAdminFromRequest(request);
    const body = (await request.json()) as { suggestionId?: string; editorName?: string };
    if (!body.suggestionId) {
      return NextResponse.json({ error: "Der Vorschlag fehlt." }, { status: 400 });
    }

    const { data: suggestion, error: suggestionError } = await supabaseAdmin!
      .from("knowledge_suggestions")
      .select("id, page_id, content")
      .eq("id", body.suggestionId)
      .maybeSingle();
    if (suggestionError) throw suggestionError;
    if (!suggestion) {
      return NextResponse.json({ error: "Der Vorschlag wurde nicht gefunden." }, { status: 404 });
    }

    const { data: page, error: pageError } = await supabaseAdmin!
      .from("knowledge_pages")
      .select("content")
      .eq("id", suggestion.page_id)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page) {
      return NextResponse.json({ error: "Die Regelseite wurde nicht gefunden." }, { status: 404 });
    }

    const existing = page.content?.trim() ?? "";
    const appended = [existing, suggestion.content].filter(Boolean).join("<p><br></p>");
    const { error: updateError } = await supabaseAdmin!
      .from("knowledge_pages")
      .update({
        content: appended,
        updated_at: new Date().toISOString(),
        updated_by: body.editorName?.trim() || user.email || "Admin"
      })
      .eq("id", suggestion.page_id);
    if (updateError) throw updateError;

    const { error: deleteError } = await supabaseAdmin!
      .from("knowledge_suggestions")
      .delete()
      .eq("id", suggestion.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vorschlag konnte nicht übernommen werden." },
      { status: 500 }
    );
  }
}
