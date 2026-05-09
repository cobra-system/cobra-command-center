-- Complete the order_requests feature for production use:
--   • Lifecycle: introduce 'rejected' and 'cancelled' statuses + reject/cancel reason
--   • Denormalize created_by_name, reviewed_by/reviewed_at for audit display
--   • supplier_id FK so rows can navigate to the supplier page
--   • estimated_unit_price (₪) so the procurement view shows budget context
--   • updated_at trigger for staleness warnings
--   • Audit log table: order_request_history
--   • Trigger: when a fulfilling order's quantity changes, sync actual_ordered_qty
--   • Trigger: when a fulfilling order is deleted, revert the request to pending
--   • RLS update: division managers may UPDATE/DELETE their own pending rows

-- ─── Status enum + reject/cancel fields ──────────────────────────────────────

ALTER TABLE order_requests
  DROP CONSTRAINT IF EXISTS order_requests_status_check;

ALTER TABLE order_requests
  ADD CONSTRAINT order_requests_status_check
  CHECK (status IN ('pending', 'ordered', 'rejected', 'cancelled'));

ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS reject_reason   TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS order_requests_supplier_id_idx ON order_requests(supplier_id);
CREATE INDEX IF NOT EXISTS order_requests_product_id_idx  ON order_requests(product_id);
CREATE INDEX IF NOT EXISTS order_requests_updated_at_idx  ON order_requests(updated_at);

-- ─── updated_at auto-touch ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_order_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_requests_touch_updated_at ON order_requests;
CREATE TRIGGER order_requests_touch_updated_at
  BEFORE UPDATE ON order_requests
  FOR EACH ROW EXECUTE FUNCTION touch_order_requests_updated_at();

-- ─── Backfill created_by_name from profiles ──────────────────────────────────

UPDATE order_requests r
SET created_by_name = p.name
FROM profiles p
WHERE r.created_by = p.id AND r.created_by_name IS NULL;

-- ─── Backfill supplier_id from supplier name where unambiguous ───────────────

UPDATE order_requests r
SET supplier_id = s.id
FROM suppliers s
WHERE r.supplier IS NOT NULL
  AND r.supplier_id IS NULL
  AND s.company = r.supplier;

-- ─── History/audit table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_request_history (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID         NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  changed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  changed_by      UUID         REFERENCES auth.users(id),
  changed_by_name TEXT,
  action          TEXT         NOT NULL CHECK (action IN ('created','updated','status_changed','fulfilled','rejected','cancelled','reverted')),
  field_name      TEXT,
  old_value       TEXT,
  new_value       TEXT,
  note            TEXT
);

CREATE INDEX IF NOT EXISTS order_request_history_request_idx ON order_request_history(request_id, changed_at DESC);

ALTER TABLE order_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_request_history_select" ON order_request_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_requests r
      WHERE r.id = order_request_history.request_id
        AND (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
          OR r.division = (SELECT division FROM profiles WHERE id = auth.uid())
        )
    )
  );

CREATE POLICY "order_request_history_insert" ON order_request_history
  FOR INSERT WITH CHECK (true);

-- ─── RLS update: allow division managers to update/delete their own pending rows

DROP POLICY IF EXISTS "order_requests_update" ON order_requests;
CREATE POLICY "order_requests_update" ON order_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
    OR (
      status = 'pending'
      AND division = (SELECT division FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_requests_delete" ON order_requests;
CREATE POLICY "order_requests_delete" ON order_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
    OR (
      status = 'pending'
      AND division = (SELECT division FROM profiles WHERE id = auth.uid())
    )
  );

-- ─── Sync trigger: keep actual_ordered_qty in lockstep with the linked order ─

CREATE OR REPLACE FUNCTION sync_order_request_actual_qty()
RETURNS TRIGGER AS $$
BEGIN
  -- Sum order line items for the affected order(s) and push into the request
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE order_requests r
    SET actual_ordered_qty = (
      SELECT COALESCE(SUM(oi.qty), 0)
      FROM order_items oi
      WHERE oi.order_id = r.order_id
    )
    WHERE r.order_id = NEW.order_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE order_requests r
    SET actual_ordered_qty = (
      SELECT COALESCE(SUM(oi.qty), 0)
      FROM order_items oi
      WHERE oi.order_id = r.order_id
    )
    WHERE r.order_id = OLD.order_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_order_request_qty_on_items ON order_items;
CREATE TRIGGER sync_order_request_qty_on_items
  AFTER INSERT OR UPDATE OF qty OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_request_actual_qty();

-- ─── Revert trigger: when a fulfilling order is deleted, return request to pending

CREATE OR REPLACE FUNCTION revert_order_request_on_order_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE order_requests
  SET status = 'pending',
      order_id = NULL,
      ordered_at = NULL,
      ordered_by = NULL,
      ordered_by_name = NULL,
      actual_ordered_qty = NULL
  WHERE order_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS revert_order_request_on_order_delete ON orders;
CREATE TRIGGER revert_order_request_on_order_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION revert_order_request_on_order_delete();
