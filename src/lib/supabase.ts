import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const forceDemoMode = process.env.NEXT_PUBLIC_FORCE_DEMO_MODE === "true";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey && !forceDemoMode);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;
