-- Fix derive_order_division to aggregate ALL unique divisions from ALL items.
--
-- Previous version used LIMIT 1 — if the first product was AWACS-only,
-- the order got division="AWACS" even if another item (e.g. Z4K) belonged
-- to multiple divisions including "פריזבי קרסו".
-- This caused division managers to miss orders that contained their products.

CREATE OR REPLACE FUNCTION public.derive_order_division(p_order_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT string_agg(DISTINCT trim(d), ', ')
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  CROSS JOIN unnest(string_to_array(p.division, ',')) AS d
  WHERE oi.order_id = p_order_id
    AND p.division IS NOT NULL
    AND trim(d) <> '';
$function$;

-- Re-sync all orders with the improved aggregation
UPDATE orders o
SET division = public.derive_order_division(o.id)
WHERE EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
);
