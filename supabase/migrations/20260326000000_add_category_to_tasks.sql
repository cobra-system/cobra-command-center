-- Add category column to tasks for one-time task classification
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category TEXT;
