-- Allow users with "edit" permission on the "products" module to write product data.
-- Managers retain full access (has_module_edit checks is_manager() first).
-- Reads remain open to all authenticated users (unchanged).

-- ── Ensure has_module_edit helper exists ─────────────────────────────────────
-- This function may not exist yet if migration 20260404000000 was not applied.

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
          (SELECT COALESCE(rd.system_key, rd.id::text)
             FROM public.role_definitions rd
             WHERE rd.id = p.role_definition_id),
          p.role::text
        )
    )
  END
$$;

-- ── products ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Managers can insert products" ON public.products;
DROP POLICY IF EXISTS "Managers can update products" ON public.products;
DROP POLICY IF EXISTS "Managers can delete products" ON public.products;

CREATE POLICY "Product editors can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('products'));

CREATE POLICY "Product editors can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (has_module_edit('products'));

CREATE POLICY "Product editors can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (has_module_edit('products'));

-- ── product_components (INSERT & DELETE only; UPDATE already handled) ────────

DROP POLICY IF EXISTS "Managers can insert components" ON public.product_components;
DROP POLICY IF EXISTS "Managers can delete components" ON public.product_components;

CREATE POLICY "Product or inventory editors can insert components"
  ON public.product_components FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory') OR has_module_edit('products'));

CREATE POLICY "Product or inventory editors can delete components"
  ON public.product_components FOR DELETE TO authenticated
  USING (has_module_edit('inventory') OR has_module_edit('products'));
