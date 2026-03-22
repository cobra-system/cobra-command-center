-- Create role_permissions table for granular per-role access control
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_key text NOT NULL,
  permission_level text NOT NULL DEFAULT 'none'
    CHECK (permission_level IN ('none', 'view', 'edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for frontend permission checks)
CREATE POLICY "Authenticated users can read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Only managers can manage permissions
CREATE POLICY "Managers can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_manager());

CREATE POLICY "Managers can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_manager());
