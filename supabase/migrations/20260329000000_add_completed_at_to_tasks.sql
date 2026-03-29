-- Add completed_at column to track when tasks were completed
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add created_by column to track who created the task (for employee-created tasks)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Set completed_at for existing DONE tasks (use updated_at as best approximation)
UPDATE public.tasks SET completed_at = updated_at WHERE status = 'DONE' AND completed_at IS NULL;
