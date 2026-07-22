-- Allow all authenticated users to update tasks (not just assignees and managers)
-- This enables employees to edit any task, matching the new unified edit dialog experience
DROP POLICY IF EXISTS "Assignees and managers can update tasks" ON public.tasks;

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
