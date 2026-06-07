-- Backfill missing linked_order_ids column (migration 20260511100000 was never applied to prod)
ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS linked_order_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE order_requests
SET linked_order_ids = ARRAY[order_id]
WHERE order_id IS NOT NULL
  AND cardinality(linked_order_ids) = 0;

CREATE INDEX IF NOT EXISTS idx_order_requests_linked_order_ids
  ON order_requests USING GIN (linked_order_ids);

CREATE OR REPLACE FUNCTION link_pending_order_request_on_order_item()
RETURNS TRIGGER AS $$
DECLARE
  matched_request RECORD;
  bonded_divisions TEXT[] := ARRAY['דלק מוטורס','פריזבי קרסו','לובינסקי'];
  actor_id   UUID;
  actor_name TEXT;
  delta_note TEXT;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  actor_id := auth.uid();
  IF actor_id IS NOT NULL THEN
    SELECT name INTO actor_name FROM profiles WHERE id = actor_id;
  END IF;
  FOR matched_request IN
    SELECT * FROM order_requests
    WHERE product_id = NEW.product_id AND status = 'pending'
      AND order_id IS NULL AND division = ANY(bonded_divisions)
    ORDER BY created_at ASC LIMIT 1
  LOOP
    UPDATE order_requests SET
      status = 'ordered', order_id = NEW.order_id,
      linked_order_ids = CASE WHEN NEW.order_id = ANY(linked_order_ids) THEN linked_order_ids
                              ELSE array_append(linked_order_ids, NEW.order_id) END,
      ordered_at = NOW(), ordered_by = actor_id, ordered_by_name = actor_name,
      actual_ordered_qty = NEW.qty, reviewed_at = NOW(),
      reviewed_by = actor_id, reviewed_by_name = actor_name
    WHERE id = matched_request.id;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Partial delivery quantity tracking
ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS received_qty NUMERIC DEFAULT NULL;

COMMENT ON COLUMN order_requests.received_qty IS
  'Units actually received so far — supports partial delivery tracking alongside delivery_status';
