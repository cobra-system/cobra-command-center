-- Re-assert recurring columns exist (safety guard in case earlier migration was not applied)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS days_before INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ;

-- Tell PostgREST to reload its schema cache so the new columns are visible
NOTIFY pgrst, 'reload schema';
