-- Allow any authenticated user to create tasks assigned to anyone
-- (managers and employees can now create tasks for each other)
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
