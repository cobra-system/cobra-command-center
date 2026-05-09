-- Wave 6: simplify the division-stock data model.
--
-- Decision: division_products.division_stock is the single source of truth for
-- "current stock per (division, product)". The duplicate column on order_requests
-- (snapshot copy) plus the bidirectional sync triggers from wave 5 introduced
-- race conditions and unclear semantics.
--
-- Cleanup steps:
--   • Drop the bidirectional sync triggers + functions
--   • Drop the auto-history clause that logged order_requests.division_stock changes
--     (we keep the audit log function but remove that specific branch)
--   • Drop order_requests.division_stock column entirely
--
-- The frontend now JOINs to division_products at read time and routes inline
-- edits of "מלאי חטיבה" to division_products.

-- 1. Drop the sync triggers + functions
DROP TRIGGER IF EXISTS sync_division_stock_to_order_request_trg ON division_products;
DROP TRIGGER IF EXISTS sync_order_request_to_division_stock_trg ON order_requests;
DROP FUNCTION IF EXISTS sync_division_stock_to_order_request();
DROP FUNCTION IF EXISTS sync_order_request_to_division_stock();

-- 2. Replace the audit-log function so it no longer references division_stock
CREATE OR REPLACE FUNCTION log_order_request_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_id   UUID;
  actor_name TEXT;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NOT NULL THEN
    SELECT name INTO actor_name FROM profiles WHERE id = actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, note)
    VALUES (NEW.id, actor_id, actor_name, 'created', NEW.product_name);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value, note)
    VALUES (
      NEW.id, actor_id, actor_name,
      CASE NEW.status
        WHEN 'ordered'   THEN 'fulfilled'
        WHEN 'rejected'  THEN 'rejected'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'pending'   THEN 'reverted'
        ELSE 'status_changed'
      END,
      'status', OLD.status, NEW.status,
      CASE WHEN NEW.status = 'rejected' THEN NEW.reject_reason ELSE NULL END
    );
  END IF;

  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'quantity', OLD.quantity::text, NEW.quantity::text);
  END IF;
  IF NEW.required_to_order IS DISTINCT FROM OLD.required_to_order THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'required_to_order', OLD.required_to_order::text, NEW.required_to_order::text);
  END IF;
  IF NEW.urgency IS DISTINCT FROM OLD.urgency THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'urgency', OLD.urgency, NEW.urgency);
  END IF;
  IF NEW.order_execution_date IS DISTINCT FROM OLD.order_execution_date THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'order_execution_date', OLD.order_execution_date::text, NEW.order_execution_date::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Migrate values into division_products before dropping the column.
--    For every (division, product_id) that has a non-null division_stock on the
--    most recent order_request, upsert it to division_products. ROUND because
--    division_products.division_stock is INTEGER while the planning column is NUMERIC.
INSERT INTO division_products (division, product_id, division_stock, division_stock_updated_at)
SELECT DISTINCT ON (r.division, r.product_id)
  r.division,
  r.product_id,
  GREATEST(0, ROUND(r.division_stock)::INTEGER),
  COALESCE(r.updated_at, r.created_at)
FROM order_requests r
WHERE r.product_id IS NOT NULL
  AND r.division_stock IS NOT NULL
ORDER BY r.division, r.product_id, r.created_at DESC
-- Prefer the existing division_products value when it's been actively edited
-- (non-zero / non-default); otherwise overwrite with the order_requests snapshot.
ON CONFLICT (division, product_id) DO UPDATE
  SET division_stock = CASE
                         WHEN division_products.division_stock = 0
                         THEN EXCLUDED.division_stock
                         ELSE division_products.division_stock
                       END,
      division_stock_updated_at = COALESCE(division_products.division_stock_updated_at, EXCLUDED.division_stock_updated_at);

-- 4. Drop the column
ALTER TABLE order_requests DROP COLUMN IF EXISTS division_stock;
