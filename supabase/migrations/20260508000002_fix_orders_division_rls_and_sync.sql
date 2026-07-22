-- Fix orders division visibility for division managers.
--
-- Root causes:
-- 1. RLS used exact equality (=) but orders.division is a comma-separated string
-- 2. sync_order_division only updated orders when division IS NULL
-- 3. derive_order_division returned LIMIT 1 (one product's division),
--    so an order with AWACS-only items + a multi-division product got division="AWACS"

-- 1. Fix RLS: ILIKE contains-check instead of exact equality
DROP POLICY IF EXISTS "non_managers_orders_select" ON orders;

CREATE POLICY "non_managers_orders_select" ON orders
  FOR SELECT USING (
    is_manager()
    OR (
      division ILIKE '%' || (SELECT division FROM profiles WHERE id = auth.uid()) || '%'
    )
  );

-- 2. Fix trigger: always update division (not just when NULL)
CREATE OR REPLACE FUNCTION public.sync_order_division()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE orders
  SET division = public.derive_order_division(NEW.order_id)
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

-- 3. Fix sync_orders_on_product_division_change: update even when division IS NOT NULL
CREATE OR REPLACE FUNCTION public.sync_orders_on_product_division_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.division IS NOT DISTINCT FROM OLD.division THEN
    RETURN NEW;
  END IF;
  UPDATE orders o
  SET division = public.derive_order_division(o.id)
  WHERE o.id IN (
    SELECT DISTINCT oi.order_id
    FROM order_items oi
    WHERE oi.product_id = NEW.id
  );
  RETURN NEW;
END;
$$;

-- 4. Re-sync all existing orders to pick up current product.division values
UPDATE orders o
SET division = public.derive_order_division(o.id)
WHERE EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
);
