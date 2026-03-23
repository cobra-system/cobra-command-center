-- Fix UPDATE policy to include explicit WITH CHECK for proper upsert support
DROP POLICY IF EXISTS "Managers can update role permissions" ON public.role_permissions;
CREATE POLICY "Managers can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());
