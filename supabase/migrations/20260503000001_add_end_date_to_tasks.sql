-- Add end_date to tasks for recurring task templates.
-- Optional cutoff date after which the recurring template stops generating instances.
-- NULL means no end date (recurs indefinitely).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Reload PostgREST schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';
