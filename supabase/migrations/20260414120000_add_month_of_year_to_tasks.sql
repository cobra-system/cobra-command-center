-- Add month_of_year to tasks table for annual recurring task templates.
-- Stores the target month (0 = January … 11 = December).
-- NULL means fall back to January (backwards-compatible default).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS month_of_year INTEGER;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
