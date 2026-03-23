-- Create task advancement log table
CREATE TABLE IF NOT EXISTS public.task_advancement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_due_date TIMESTAMPTZ,
  new_due_date TIMESTAMPTZ NOT NULL,
  advanced_at TIMESTAMPTZ DEFAULT now(),
  advanced_by TEXT DEFAULT 'system_auto_advance',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_task_advancement_log_task_id ON public.task_advancement_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_advancement_log_advanced_at ON public.task_advancement_log(advanced_at DESC);

-- Add comment documenting the table
COMMENT ON TABLE public.task_advancement_log IS 'Audit log for automatically advanced overdue tasks';
COMMENT ON COLUMN public.task_advancement_log.task_id IS 'Reference to the task that was advanced';
COMMENT ON COLUMN public.task_advancement_log.old_due_date IS 'Original due date before advancement';
COMMENT ON COLUMN public.task_advancement_log.new_due_date IS 'New due date after advancement';
COMMENT ON COLUMN public.task_advancement_log.advanced_by IS 'System identifier for advancement method (system_auto_advance, user_manual, edge_function, etc)';
COMMENT ON COLUMN public.task_advancement_log.notes IS 'Additional notes about the advancement';

-- Set up Row Level Security if needed
ALTER TABLE public.task_advancement_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read advancement logs
CREATE POLICY "Allow authenticated users to read advancement logs" ON public.task_advancement_log
  FOR SELECT USING (auth.role() = 'authenticated');
