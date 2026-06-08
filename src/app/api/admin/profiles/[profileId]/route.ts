import { NextResponse } from "next/server";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(request: Request, context: { params: Promise<{ profileId: string }> }) {
  try {
    await requireAdminFromRequest(request);
    const { profileId } = await context.params;
    const { error } = await supabaseAdmin!.auth.admin.deleteUser(profileId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json({ error: "Profil konnte nicht gelöscht werden." }, { status: 500 });
  }
}
