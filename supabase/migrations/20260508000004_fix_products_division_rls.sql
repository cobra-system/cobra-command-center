-- Fix products division RLS for non-managers.
--
-- The previous policy had a column-name confusion in the subquery:
--   division ILIKE '%' || (SELECT products.division FROM profiles WHERE ...) || '%'
-- "products.division" inside that subquery resolves to the OUTER row being
-- checked, not to the joined profile, so the predicate degenerates to
--   division ILIKE '%' || division || '%'   -- always true
-- which silently disables row-level scoping. Division managers were only being
-- limited by the client-side filter in ProductsContext.
--
-- Fix: reference profiles.division explicitly, and treat products with a
-- NULL/empty division as shared (visible to everyone), so legacy rows that
-- haven't been categorised aren't suddenly hidden from the field.
DROP POLICY IF EXISTS "non_managers_products_select" ON public.products;

CREATE POLICY "non_managers_products_select" ON public.products
  FOR SELECT TO authenticated
  USING (
    public.is_manager()
    OR division IS NULL
    OR division = ''
    OR (SELECT profiles.division FROM public.profiles WHERE profiles.id = auth.uid()) IS NULL
    OR division ILIKE '%' || (SELECT profiles.division FROM public.profiles WHERE profiles.id = auth.uid()) || '%'
  );
