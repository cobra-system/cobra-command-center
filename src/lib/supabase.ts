/**
 * Custom Supabase client pointing to the external project.
 * All app code should import { supabase } from "@/lib/supabase" instead of
 * "@/integrations/supabase/client".
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set"
  );
}

export const supabase = createClient<Database>(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
export const SUPABASE_URL = EXTERNAL_SUPABASE_URL;
export const SUPABASE_ANON_KEY = EXTERNAL_SUPABASE_ANON_KEY;
