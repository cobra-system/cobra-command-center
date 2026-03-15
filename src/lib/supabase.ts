/**
 * Supabase client - now using Lovable Cloud (internal project).
 * All app code should import { supabase } from "@/lib/supabase".
 */
import { supabase } from "@/integrations/supabase/client";

// Re-export from the auto-generated client
export { supabase };

// These point to Lovable Cloud
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
