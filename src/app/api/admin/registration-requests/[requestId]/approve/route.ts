import { NextResponse } from "next/server";
import { requireAdminFromRequest, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    await requireAdminFromRequest(request);
    const { requestId } = await context.params;
    const { data: registration, error: requestError } = await supabaseAdmin!
      .from("registration_requests")
      .select("id, name, email, phone, password, status")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError || !registration) {
      return NextResponse.json({ error: requestError?.message ?? "Anfrage nicht gefunden." }, { status: 404 });
    }

    const email = registration.email.trim().toLowerCase();
    const { data: created, error: createError } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password: registration.password,
      email_confirm: true,
      user_metadata: { name: registration.name }
    });
    let userId = created.user?.id;
    if (createError || !userId) {
      const { data: users, error: listError } = await supabaseAdmin!.auth.admin.listUsers();
      const existing = users?.users.find((user) => user.email?.toLowerCase() === email);
      if (listError || !existing) {
        return NextResponse.json({ error: createError?.message ?? "Benutzer konnte nicht erstellt werden." }, { status: 400 });
      }
      userId = existing.id;
    }

    const { error: profileError } = await supabaseAdmin!.from("profiles").upsert({
      id: userId,
      name: registration.name,
      email,
      phone: registration.phone ?? "",
      role: "technician"
    });
    if (profileError) {
      if (created.user?.id) {
        await supabaseAdmin!.auth.admin.deleteUser(created.user.id);
      }
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin!
      .from("registration_requests")
      .update({ status: "approved" })
      .eq("id", requestId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json({ error: "Anfrage konnte nicht angenommen werden." }, { status: 500 });
  }
}
