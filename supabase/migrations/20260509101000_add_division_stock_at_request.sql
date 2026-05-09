-- Wave 7 part 2: add an immutable snapshot of "what was the division stock when
-- this request was filed". Useful for audit ("did the planner know the stock
-- was already X when they asked for Y?") and for trend analysis.
--
-- Semantics (intentionally minimal):
--   • Populated once at INSERT time from the current division_products.division_stock
--     for the (division, product_id) pair, when product_id is set.
--   • NEVER auto-updated afterwards. If the division stock changes later, this
--     column does not move.
--   • If the row is created without a product_id, the column stays NULL.

ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS division_stock_at_request INTEGER;

COMMENT ON COLUMN order_requests.division_stock_at_request IS
  'Immutable snapshot of division_products.division_stock at the moment this request was created. NULL when the request has no product_id, or when the product had no division_products row yet.';

CREATE OR REPLACE FUNCTION snapshot_division_stock_on_request()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Only snapshot at creation; never overwrite if already set.
  IF NEW.division_stock_at_request IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT division_stock INTO current_stock
  FROM division_products
  WHERE division = NEW.division AND product_id = NEW.product_id;

  NEW.division_stock_at_request := current_stock;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS snapshot_division_stock_on_request_trg ON order_requests;
CREATE TRIGGER snapshot_division_stock_on_request_trg
  BEFORE INSERT ON order_requests
  FOR EACH ROW EXECUTE FUNCTION snapshot_division_stock_on_request();

-- Backfill existing pending rows with the current stock. Older completed rows
-- stay NULL — we never knew the value at their creation time.
UPDATE order_requests r
SET division_stock_at_request = dp.division_stock
FROM division_products dp
WHERE r.product_id IS NOT NULL
  AND r.division_stock_at_request IS NULL
  AND dp.division = r.division
  AND dp.product_id = r.product_id
  AND r.status = 'pending';
