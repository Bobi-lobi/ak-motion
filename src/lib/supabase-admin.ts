import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseAdminConfig = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseAdminConfig
  ? createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function requireAdminFromRequest(request: Request) {
  if (!supabaseAdmin) {
    throw new Response("Supabase Admin ist nicht konfiguriert.", { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Response("Nicht angemeldet.", { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Response("Session konnte nicht geprüft werden.", { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") {
    throw new Response("Nur Admins dürfen diese Aktion ausführen.", { status: 403 });
  }

  return userData.user;
}
