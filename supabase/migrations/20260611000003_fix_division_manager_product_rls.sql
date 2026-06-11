-- Fix 1: is_division_manager() was checking role_definitions table, but the app
-- identifies division managers as any non-MANAGER user who has a division set
-- in their profile. Align the DB function with the frontend isDivisionManager() logic.
CREATE OR REPLACE FUNCTION public.is_division_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role <> 'MANAGER'
      AND division IS NOT NULL
      AND division <> ''
  );
$$;

-- Fix 2: products_insert was requiring division IS NOT NULL on the product row,
-- but addProduct() in ProductsContext strips the division column before inserting
-- (division linkage is stored in division_products, not on the product row itself).
-- Allow any division manager to create products; the division_products link is
-- created immediately after by syncDivisionProducts().
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT
  WITH CHECK (
    is_manager()
    OR is_division_manager()
  );

-- Fix 3: products_update — check division_products for accurate scope instead of
-- relying on the products.division column which is often NULL.
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE
  USING (
    is_manager()
    OR (
      is_division_manager()
      AND EXISTS (
        SELECT 1 FROM division_products dp
        WHERE dp.product_id = products.id
          AND dp.division = current_user_division()
      )
    )
  )
  WITH CHECK (
    is_manager()
    OR is_division_manager()
  );

-- Fix 4: products_delete — same scope check via division_products.
DROP POLICY IF EXISTS products_delete ON public.products;
CREATE POLICY products_delete ON public.products
  FOR DELETE
  USING (
    is_manager()
    OR (
      is_division_manager()
      AND EXISTS (
        SELECT 1 FROM division_products dp
        WHERE dp.product_id = products.id
          AND dp.division = current_user_division()
      )
    )
  );
