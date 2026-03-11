import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://pjruyvhtivbeikxrnipg.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable"
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
