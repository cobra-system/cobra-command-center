-- Allow all authenticated users to read products, regardless of division.
--
-- Bonded division managers need to be able to submit purchase requests for any
-- product in the system — not only the ones already attached to their division.
-- The product picker on the new-request dialog therefore needs to show every
-- product. Prices remain masked by the products_safe view; this policy only
-- governs visibility of the row, not the sensitive columns.

DROP POLICY IF EXISTS "non_managers_products_select" ON public.products;

CREATE POLICY "authenticated_products_select" ON public.products
  FOR SELECT TO authenticated
  USING (true);
