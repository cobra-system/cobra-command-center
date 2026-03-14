/**
 * Custom Supabase client pointing to the external project.
 * All app code should import { supabase } from "@/lib/supabase" instead of
 * "@/integrations/supabase/client".
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const EXTERNAL_SUPABASE_URL = "https://ljpdwezgahrrffnwajho.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcGR3ZXpnYWhycmZmbndhamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYyNDEsImV4cCI6MjA4ODU5MjI0MX0.jMGjQYWEwV8CrOEZITrJf-K_r7NMTAmygQLaV3JJiUQ";

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

export const SUPABASE_PROJECT_ID = "ljpdwezgahrrffnwajho";
export const SUPABASE_URL = EXTERNAL_SUPABASE_URL;
export const SUPABASE_ANON_KEY = EXTERNAL_SUPABASE_ANON_KEY;
