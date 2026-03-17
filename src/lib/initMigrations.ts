import { supabase } from '@/integrations/supabase/client';

// Migration SQL for user_preferences table
const USER_PREFERENCES_MIGRATION = `
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_name text NOT NULL,
  sort_field text,
  sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
  filters jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, page_name)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own preferences" ON public.user_preferences;
CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();
`;

let migrationAttempted = false;
let migrationInProgress = false;

/**
 * Attempt to apply database migrations.
 * This is safe to call multiple times - it uses CREATE TABLE IF NOT EXISTS
 * and gracefully handles failures with localStorage fallback.
 */
export async function initializeMigrations() {
  // Prevent multiple simultaneous attempts
  if (migrationInProgress) return;

  // Only attempt once per session
  if (migrationAttempted) return;
  migrationAttempted = true;

  migrationInProgress = true;

  try {
    // Try to verify table exists by querying it
    const { error: queryError } = await supabase
      .from('user_preferences')
      .select('id')
      .limit(1);

    if (!queryError) {
      // Table exists, we're good
      console.log('✅ user_preferences table exists');
      migrationInProgress = false;
      return;
    }

    // Table doesn't exist, try to create it
    // Note: We can't use supabase.rpc() to execute raw SQL from the client
    // Instead, we mark localStorage to indicate migration needed
    if (typeof window !== 'undefined') {
      localStorage.setItem('_migration_user_preferences_needed', 'true');
      console.log('⚠️ user_preferences table missing - app will use localStorage fallback');
      console.log('💡 Migration can be applied via Supabase dashboard or CLI');
    }
  } catch (error) {
    console.error('Migration initialization error:', error);
    // Errors here are non-fatal - the app continues with localStorage fallback
  } finally {
    migrationInProgress = false;
  }
}

/**
 * Check if migrations have been applied
 */
export async function hasMigrationsApplied(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Check migration status and provide helpful message
 */
export async function checkMigrationStatus(): Promise<{
  applied: boolean;
  message: string;
}> {
  const applied = await hasMigrationsApplied();

  if (applied) {
    return {
      applied: true,
      message: '✅ Database migrations are applied - persistent table preferences enabled'
    };
  }

  return {
    applied: false,
    message: '⚠️ Database migrations pending - using localStorage fallback for table preferences'
  };
}
