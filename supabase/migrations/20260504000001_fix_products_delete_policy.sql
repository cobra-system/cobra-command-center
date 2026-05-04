-- The products table is missing a DELETE RLS policy.
-- The migration that was supposed to create "Product editors can delete products"
-- did not take effect, leaving the table with INSERT and UPDATE policies but no DELETE.
-- PostgREST raises an error for mutations when no matching policy exists, causing
-- all product deletion attempts to fail.
--
-- Add a DELETE policy consistent with the existing INSERT/UPDATE policies (is_manager()).

DROP POLICY IF EXISTS "Product editors can delete products" ON public.products;
DROP POLICY IF EXISTS "Managers can delete products" ON public.products;
DROP POLICY IF EXISTS "managers_products_delete" ON public.products;

CREATE POLICY "managers_products_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (is_manager());
