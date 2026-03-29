-- Allow employees to create tasks assigned to themselves
-- Drop the existing insert policy and create a new one that includes employees
DROP POLICY IF EXISTS "Managers can insert tasks" ON public.tasks;

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Managers can create any task
    public.is_manager()
    OR
    -- Non-managers can only create tasks assigned to themselves
    (assignee_id = auth.uid())
  );
