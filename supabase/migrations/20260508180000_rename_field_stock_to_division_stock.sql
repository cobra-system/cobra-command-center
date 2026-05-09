-- Wave 5 part 1: unify "stock per division+product" naming.
--
-- division_products.field_stock           → division_stock
-- division_products.field_stock_updated_at → division_stock_updated_at
--
-- The naming aligns with order_requests.division_stock (the planning column).
-- division_products remains the source-of-truth single row per (division, product);
-- planning rows continue to carry their own snapshot in order_requests.division_stock.

ALTER TABLE division_products
  RENAME COLUMN field_stock TO division_stock;

ALTER TABLE division_products
  RENAME COLUMN field_stock_updated_at TO division_stock_updated_at;

-- Sync trigger: when division_products.division_stock changes, mirror the value
-- into the latest pending order_request for that (division, product).
-- That keeps the planning sheet up to date with the canonical figure without
-- a manual re-entry, while preserving the historical snapshot on completed rows.

CREATE OR REPLACE FUNCTION sync_division_stock_to_order_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.division_stock IS DISTINCT FROM OLD.division_stock THEN
    UPDATE order_requests r
    SET division_stock = NEW.division_stock
    WHERE r.division = NEW.division
      AND r.product_id = NEW.product_id
      AND r.status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_division_stock_to_order_request_trg ON division_products;
CREATE TRIGGER sync_division_stock_to_order_request_trg
  AFTER UPDATE OF division_stock ON division_products
  FOR EACH ROW EXECUTE FUNCTION sync_division_stock_to_order_request();

-- And the other direction: when a manager edits division_stock on a pending
-- planning row in order_requests, push it back into division_products too.
CREATE OR REPLACE FUNCTION sync_order_request_to_division_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.product_id IS NOT NULL
     AND NEW.division_stock IS DISTINCT FROM OLD.division_stock
  THEN
    INSERT INTO division_products (division, product_id, division_stock, division_stock_updated_at)
    VALUES (NEW.division, NEW.product_id, NEW.division_stock, NOW())
    ON CONFLICT (division, product_id) DO UPDATE
      SET division_stock = EXCLUDED.division_stock,
          division_stock_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_order_request_to_division_stock_trg ON order_requests;
CREATE TRIGGER sync_order_request_to_division_stock_trg
  AFTER UPDATE OF division_stock ON order_requests
  FOR EACH ROW EXECUTE FUNCTION sync_order_request_to_division_stock();
