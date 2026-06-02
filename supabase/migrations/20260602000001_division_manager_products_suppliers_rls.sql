-- Allow Division Managers to:
--   * see ALL products (not just their division), so they can find
--     an existing product before creating a new one
--   * insert/update/delete products that belong to their own division
--   * insert/update/delete suppliers (no division field on suppliers)
--
-- Managers continue to have full access on everything. Other non-manager
-- roles keep their previous behavior (only see products in their division).

-- Helper: is the current user a Division Manager?
CREATE OR REPLACE FUNCTION public.is_division_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN role_definitions rd ON rd.id = p.role_definition_id
    WHERE p.id = auth.uid()
      AND rd.system_key = 'DIVISION_MANAGER'
  );
$$;

-- Helper: division of the current user
CREATE OR REPLACE FUNCTION public.current_user_division()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT division FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- PRODUCTS
-- ============================================================

DROP POLICY IF EXISTS non_managers_products_select ON public.products;
CREATE POLICY non_managers_products_select ON public.products
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_manager()
      OR is_division_manager()
      OR division IS NULL
      OR division = ''
      OR current_user_division() IS NULL
      OR division ILIKE '%' || current_user_division() || '%'
    )
  );

DROP POLICY IF EXISTS managers_products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT
  WITH CHECK (
    is_manager()
    OR (
      is_division_manager()
      AND current_user_division() IS NOT NULL
      AND division IS NOT NULL
      AND division ILIKE '%' || current_user_division() || '%'
    )
  );

DROP POLICY IF EXISTS managers_products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE
  USING (
    is_manager()
    OR (
      is_division_manager()
      AND current_user_division() IS NOT NULL
      AND division IS NOT NULL
      AND division ILIKE '%' || current_user_division() || '%'
    )
  )
  WITH CHECK (
    is_manager()
    OR (
      is_division_manager()
      AND current_user_division() IS NOT NULL
      AND division IS NOT NULL
      AND division ILIKE '%' || current_user_division() || '%'
    )
  );

DROP POLICY IF EXISTS managers_products_delete ON public.products;
CREATE POLICY products_delete ON public.products
  FOR DELETE
  USING (
    is_manager()
    OR (
      is_division_manager()
      AND current_user_division() IS NOT NULL
      AND division IS NOT NULL
      AND division ILIKE '%' || current_user_division() || '%'
    )
  );

-- ============================================================
-- SUPPLIERS (no division field — division managers get full access)
-- ============================================================

DROP POLICY IF EXISTS "Managers can insert suppliers" ON public.suppliers;
CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT
  WITH CHECK (is_manager() OR is_division_manager());

DROP POLICY IF EXISTS "Managers can update suppliers" ON public.suppliers;
CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE
  USING (is_manager() OR is_division_manager())
  WITH CHECK (is_manager() OR is_division_manager());

DROP POLICY IF EXISTS "Managers can delete suppliers" ON public.suppliers;
CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE
  USING (is_manager() OR is_division_manager());
