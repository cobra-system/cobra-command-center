-- Add depends_on column to tasks table for Gantt chart dependencies
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on uuid[] DEFAULT '{}';

-- Create index for dependency lookups
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON public.tasks USING gin(depends_on);
