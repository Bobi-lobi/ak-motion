import { NextResponse } from "next/server";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const body = (await request.json()) as { email?: string; name?: string; password?: string; phone?: string; role?: UserRole };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password?.trim() || "technik123";
    const role = body.role ?? "technician";

    if (!email || !name) {
      return NextResponse.json({ error: "Name und E-Mail sind erforderlich." }, { status: 400 });
    }

    const { data: created, error: createError } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "Benutzer konnte nicht erstellt werden." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin!
      .from("profiles")
      .upsert({
        id: created.user.id,
        name,
        email,
        phone: body.phone?.trim() ?? "",
        role
      })
      .select("id, name, email, avatar_url, phone, role, created_at")
      .single();
    if (profileError || !profile) {
      await supabaseAdmin!.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError?.message ?? "Profil konnte nicht erstellt werden." }, { status: 400 });
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatar_url ?? "",
        phone: profile.phone ?? "",
        role: profile.role,
        createdAt: profile.created_at
      }
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json({ error: "Profil konnte nicht erstellt werden." }, { status: 500 });
  }
}
