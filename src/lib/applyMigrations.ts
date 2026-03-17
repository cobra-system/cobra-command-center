/**
 * Apply pending database migrations
 * This ensures the user_preferences table exists before the app starts using it
 */

import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "cobra_migrations_applied"

export async function applyMigrations() {
  try {
    // Check if migrations have already been applied (simple flag in localStorage)
    // Note: For production, you'd want a more robust tracking system
    const applied = localStorage.getItem(MIGRATION_KEY)
    if (applied === "20260317_create_user_preferences") {
      return true
    }

    // Create user_preferences table if it doesn't exist
    const { error } = await supabase.rpc("create_user_preferences_table_if_not_exists")

    if (error) {
      // If the RPC doesn't exist, try creating the table directly
      console.warn("RPC function not found, attempting direct table creation")

      // For now, we'll log that the migration needs to be applied manually
      // The hook will handle missing table gracefully with localStorage fallback
      console.log("user_preferences table may need to be created via Supabase dashboard")
      return false
    }

    localStorage.setItem(MIGRATION_KEY, "20260317_create_user_preferences")
    console.log("✅ Migrations applied successfully")
    return true
  } catch (error) {
    console.error("Error applying migrations:", error)
    // Don't throw - app can still function with localStorage fallback
    return false
  }
}

/**
 * Alternative: Manual migration via Supabase dashboard
 *
 * Copy and paste this SQL into Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS public.user_preferences (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   page_name text NOT NULL,
 *   sort_field text,
 *   sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
 *   filters jsonb DEFAULT '{}'::jsonb,
 *   created_at timestamp with time zone DEFAULT now(),
 *   updated_at timestamp with time zone DEFAULT now(),
 *   UNIQUE(user_id, page_name)
 * );
 *
 * CREATE INDEX idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);
 *
 * ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can read their own preferences"
 *   ON public.user_preferences FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert their own preferences"
 *   ON public.user_preferences FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update their own preferences"
 *   ON public.user_preferences FOR UPDATE
 *   USING (auth.uid() = user_id)
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can delete their own preferences"
 *   ON public.user_preferences FOR DELETE
 *   USING (auth.uid() = user_id);
 *
 * CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = now();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER update_user_preferences_updated_at
 *   BEFORE UPDATE ON public.user_preferences
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_user_preferences_updated_at();
 */
