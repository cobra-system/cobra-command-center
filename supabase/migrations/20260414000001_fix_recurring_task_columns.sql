-- Fix: Add recurring columns to tasks table (idempotent)
-- These were defined in 20260325210000_merge_recurring_into_tasks.sql but
-- may not have been applied to the live Supabase instance.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS days_before INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurring_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Drop the old standalone recurring_tasks table if it still exists
DROP TABLE IF EXISTS public.recurring_tasks CASCADE;

-- Reload PostgREST schema cache so the new columns are visible immediately
NOTIFY pgrst, 'reload schema';
