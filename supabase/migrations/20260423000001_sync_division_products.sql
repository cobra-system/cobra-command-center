-- ─────────────────────────────────────────────────────────────
-- Sync division_products ↔ products.division (bidirectional)
-- ─────────────────────────────────────────────────────────────

-- 1. One-time backfill: populate division_products from products.division
INSERT INTO division_products (division, product_id)
SELECT TRIM(d), p.id
FROM products p
CROSS JOIN LATERAL unnest(string_to_array(p.division, ',')) AS d
WHERE p.division IS NOT NULL
  AND TRIM(d) != ''
ON CONFLICT (division, product_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger A: products.division → division_products
--    Fires AFTER INSERT OR UPDATE OF division ON products.
--    Skips when depth > 0 (i.e. called from within Trigger B)
--    to prevent infinite loops.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_division_products_from_product()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_divs TEXT[];
  old_divs TEXT[];
BEGIN
  -- Prevent re-entry from Trigger B's UPDATE on products
  IF pg_trigger_depth() > 0 THEN
    RETURN NEW;
  END IF;

  new_divs := ARRAY(
    SELECT TRIM(d)
    FROM unnest(string_to_array(NEW.division, ',')) d
    WHERE TRIM(d) != ''
  );

  IF TG_OP = 'UPDATE' THEN
    old_divs := ARRAY(
      SELECT TRIM(d)
      FROM unnest(string_to_array(OLD.division, ',')) d
      WHERE TRIM(d) != ''
    );
  ELSE
    old_divs := '{}'::TEXT[];
  END IF;

  -- Remove divisions that were dropped
  DELETE FROM division_products
  WHERE product_id = NEW.id
    AND division = ANY(old_divs)
    AND NOT (division = ANY(new_divs));

  -- Add divisions that were added
  INSERT INTO division_products (division, product_id)
  SELECT d, NEW.id
  FROM unnest(new_divs) d
  WHERE NOT EXISTS (
    SELECT 1 FROM division_products
    WHERE division = d AND product_id = NEW.id
  )
  ON CONFLICT (division, product_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_division_products ON products;
CREATE TRIGGER trg_sync_division_products
AFTER INSERT OR UPDATE OF division ON products
FOR EACH ROW
EXECUTE FUNCTION sync_division_products_from_product();

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger B: division_products → products.division
--    Fires AFTER INSERT OR DELETE ON division_products.
--    Recomputes the comma-separated division string for the
--    affected product and only writes if the value changed
--    (prevents the loop with Trigger A).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_product_division_from_dp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_product_id UUID;
  computed_division  TEXT;
  current_division   TEXT;
BEGIN
  target_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;

  -- Aggregate remaining divisions for this product (alphabetical order)
  SELECT string_agg(division, ', ' ORDER BY division)
  INTO computed_division
  FROM division_products
  WHERE product_id = target_product_id;

  -- Read current value
  SELECT division INTO current_division
  FROM products WHERE id = target_product_id;

  -- Only update when the value actually differs (breaks the loop)
  IF computed_division IS DISTINCT FROM current_division THEN
    UPDATE products SET division = computed_division WHERE id = target_product_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_division ON division_products;
CREATE TRIGGER trg_sync_product_division
AFTER INSERT OR DELETE ON division_products
FOR EACH ROW
EXECUTE FUNCTION sync_product_division_from_dp();
