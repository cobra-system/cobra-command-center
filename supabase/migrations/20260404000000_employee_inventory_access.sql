
-- Allow employees with "edit" permission on the "inventory" module to write inventory data.
-- Managers retain full access. Reads remain open to all authenticated users.

-- Helper: returns true if the current user has "edit" permission for a given module key.
-- Handles both system roles (app_role) and custom role_definition_id.
CREATE OR REPLACE FUNCTION public.has_module_edit(module_key text)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_manager() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE rp.module_key = has_module_edit.module_key
        AND rp.permission_level = 'edit'
        AND rp.role = COALESCE(
          -- Custom role: prefer system_key, fall back to UUID string
          (SELECT COALESCE(rd.system_key, rd.id::text)
             FROM public.role_definitions rd
             WHERE rd.id = p.role_definition_id),
          -- System role: use the app_role cast to text
          p.role::text
        )
    )
  END
$$;

-- ── center_inventory ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert center inventory" ON public.center_inventory;
DROP POLICY IF EXISTS "Managers can update center inventory" ON public.center_inventory;
DROP POLICY IF EXISTS "Managers can delete center inventory" ON public.center_inventory;

CREATE POLICY "Inventory editors can insert center inventory"
  ON public.center_inventory FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can update center inventory"
  ON public.center_inventory FOR UPDATE TO authenticated
  USING (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can delete center inventory"
  ON public.center_inventory FOR DELETE TO authenticated
  USING (has_module_edit('inventory'));

-- ── inventory_transfers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert transfers" ON public.inventory_transfers;
DROP POLICY IF EXISTS "Managers can delete transfers" ON public.inventory_transfers;

CREATE POLICY "Inventory editors can insert transfers"
  ON public.inventory_transfers FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can delete transfers"
  ON public.inventory_transfers FOR DELETE TO authenticated
  USING (has_module_edit('inventory'));

-- ── inventory_change_log ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert inventory log" ON public.inventory_change_log;
DROP POLICY IF EXISTS "Managers can delete inventory log" ON public.inventory_change_log;

CREATE POLICY "Inventory editors can insert inventory log"
  ON public.inventory_change_log FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can delete inventory log"
  ON public.inventory_change_log FOR DELETE TO authenticated
  USING (has_module_edit('inventory'));

-- ── distribution_centers ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert centers" ON public.distribution_centers;
DROP POLICY IF EXISTS "Managers can update centers" ON public.distribution_centers;
DROP POLICY IF EXISTS "Managers can delete centers" ON public.distribution_centers;

CREATE POLICY "Inventory editors can insert centers"
  ON public.distribution_centers FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can update centers"
  ON public.distribution_centers FOR UPDATE TO authenticated
  USING (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can delete centers"
  ON public.distribution_centers FOR DELETE TO authenticated
  USING (has_module_edit('inventory'));

-- ── center_contacts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert center contacts" ON public.center_contacts;
DROP POLICY IF EXISTS "Managers can update center contacts" ON public.center_contacts;
DROP POLICY IF EXISTS "Managers can delete center contacts" ON public.center_contacts;

CREATE POLICY "Inventory editors can insert center contacts"
  ON public.center_contacts FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can update center contacts"
  ON public.center_contacts FOR UPDATE TO authenticated
  USING (has_module_edit('inventory'));

CREATE POLICY "Inventory editors can delete center contacts"
  ON public.center_contacts FOR DELETE TO authenticated
  USING (has_module_edit('inventory'));
