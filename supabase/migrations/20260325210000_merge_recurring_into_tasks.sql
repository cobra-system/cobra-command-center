-- Migration: Merge recurring_tasks into tasks table
-- A task with frequency IS NOT NULL = recurring template
-- A task with recurring_task_id IS NOT NULL = instance generated from template
-- Both NULL = regular one-off task

-- Step 1: Add recurring-related columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS days_before INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ;

-- Step 2: Copy recurring_tasks into tasks (preserving IDs so recurring_task_id FK still works)
INSERT INTO public.tasks (id, title, description, priority, status, assignee_id, assignee_name, frequency, day_of_week, day_of_month, days_before, time_of_day, is_active, last_generated, is_daily, created_at, updated_at)
SELECT
  id, title, description,
  COALESCE(priority, 'בינוני'),
  'TEMPLATE',  -- special status for templates (never shown as regular tasks)
  assignee_id, assignee_name,
  frequency, day_of_week, day_of_month,
  COALESCE(days_before, 0),
  COALESCE(time_of_day, '09:00'),
  is_active,
  last_generated,
  false,
  created_at, updated_at
FROM public.recurring_tasks
ON CONFLICT (id) DO NOTHING;

-- Step 3: Make recurring_task_id a self-referencing FK on tasks
-- First drop the old FK if it exists
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_recurring_task_id_fkey;

-- Add self-referencing FK
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurring_task_id_fkey
  FOREIGN KEY (recurring_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Step 4: Drop the old recurring_tasks table
DROP TABLE IF EXISTS public.recurring_tasks CASCADE;
