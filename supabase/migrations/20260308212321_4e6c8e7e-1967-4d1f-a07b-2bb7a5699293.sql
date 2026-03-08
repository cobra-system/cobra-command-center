
-- Create role_definitions table for managing custom role display names
CREATE TABLE public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  system_key text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Authenticated users can read role definitions"
  ON public.role_definitions FOR SELECT TO authenticated USING (true);

-- Only managers can manage
CREATE POLICY "Managers can insert role definitions"
  ON public.role_definitions FOR INSERT TO authenticated WITH CHECK (is_manager());

CREATE POLICY "Managers can update role definitions"
  ON public.role_definitions FOR UPDATE TO authenticated USING (is_manager());

CREATE POLICY "Managers can delete role definitions"
  ON public.role_definitions FOR DELETE TO authenticated USING (is_manager());

-- Seed default roles
INSERT INTO public.role_definitions (name, system_key) VALUES
  ('מנהל מחסן', 'WAREHOUSE_MANAGER'),
  ('לוגיסטיקה', 'LOGISTICS'),
  ('נהג', 'DRIVER');
