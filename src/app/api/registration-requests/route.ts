import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RegistrationBody = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  motivation?: string;
};

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase Admin ist nicht konfiguriert." }, { status: 500 });
    }

    const body = (await request.json()) as RegistrationBody;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() ?? "";
    const password = body.password ?? "";
    const motivation = body.motivation?.trim() ?? "";

    if (!name || !email || password.length < 6) {
      return NextResponse.json({ error: "Name, E-Mail und ein Passwort mit mindestens 6 Zeichen sind erforderlich." }, { status: 400 });
    }

    const { data: existingProfiles, error: profileError } = await supabaseAdmin.from("profiles").select("id").eq("email", email).limit(1);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
    if (existingProfiles?.length) {
      return NextResponse.json({ error: "Für diese E-Mail gibt es bereits einen freigeschalteten Account." }, { status: 409 });
    }

    const { data: existingRequests, error: requestError } = await supabaseAdmin
      .from("registration_requests")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .limit(1);
    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 400 });
    }
    if (existingRequests?.length) {
      return NextResponse.json({ error: "Für diese E-Mail liegt bereits eine Bewerbung vor." }, { status: 409 });
    }

    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }
    const existingUser = users.users.find((user) => user.email?.toLowerCase() === email);

    let authUserId = existingUser?.id;
    let createdAuthUser = false;

    if (authUserId) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: { name }
      });
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    } else {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });
      if (createError || !created.user) {
        return NextResponse.json({ error: createError?.message ?? "Account konnte nicht erstellt werden." }, { status: 400 });
      }
      authUserId = created.user.id;
      createdAuthUser = true;
    }

    const { error: insertError } = await supabaseAdmin.from("registration_requests").insert({
      auth_user_id: authUserId,
      name,
      email,
      phone,
      motivation,
      status: "pending"
    });
    if (insertError) {
      if (createdAuthUser && authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bewerbung konnte nicht erstellt werden." }, { status: 500 });
  }
}
