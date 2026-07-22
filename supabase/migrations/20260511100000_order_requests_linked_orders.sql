-- Add support for linking an order request to multiple orders.
--
-- The original schema had a single order_id pointing to the resulting order,
-- but the attach-to-existing-order flow can pick more than one open order.
-- We keep order_id for back-compat (first/primary link) and add an array column
-- that holds every order id the request was attached to.

ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS linked_order_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill: any row that already has an order_id should appear in the array too.
UPDATE order_requests
SET linked_order_ids = ARRAY[order_id]
WHERE order_id IS NOT NULL
  AND (linked_order_ids IS NULL OR cardinality(linked_order_ids) = 0);

CREATE INDEX IF NOT EXISTS idx_order_requests_linked_order_ids
  ON order_requests USING GIN (linked_order_ids);

-- Keep the reverse-flow trigger in sync: when an order_item is inserted and the
-- trigger updates a matched request, also append the order_id to the array.
CREATE OR REPLACE FUNCTION link_pending_order_request_on_order_item()
RETURNS TRIGGER AS $$
DECLARE
  matched_request RECORD;
  bonded_divisions TEXT[] := ARRAY['דלק מוטורס','פריזבי קרסו','לובינסקי'];
  actor_id   UUID;
  actor_name TEXT;
  delta_note TEXT;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  actor_id := auth.uid();
  IF actor_id IS NOT NULL THEN
    SELECT name INTO actor_name FROM profiles WHERE id = actor_id;
  END IF;

  FOR matched_request IN
    SELECT *
    FROM order_requests
    WHERE product_id = NEW.product_id
      AND status = 'pending'
      AND order_id IS NULL
      AND division = ANY(bonded_divisions)
    ORDER BY created_at ASC
    LIMIT 1
  LOOP
    UPDATE order_requests
    SET status = 'ordered',
        order_id = NEW.order_id,
        linked_order_ids = CASE
          WHEN NEW.order_id = ANY(linked_order_ids) THEN linked_order_ids
          ELSE array_append(linked_order_ids, NEW.order_id)
        END,
        ordered_at = NOW(),
        ordered_by = actor_id,
        ordered_by_name = actor_name,
        actual_ordered_qty = NEW.qty,
        reviewed_at = NOW(),
        reviewed_by = actor_id,
        reviewed_by_name = actor_name
    WHERE id = matched_request.id;

    IF matched_request.required_to_order IS NOT NULL
       AND matched_request.required_to_order <> NEW.qty
    THEN
      delta_note := 'הבקשה הופנתה להזמנה אך בכמות שונה: התבקש ' ||
                    matched_request.required_to_order::text ||
                    ', הוזמן בפועל ' || NEW.qty::text || '.';
      INSERT INTO order_request_comments (request_id, body, created_by, created_by_name, created_by_role)
      VALUES (matched_request.id, delta_note, actor_id, actor_name, 'MANAGER');
    ELSIF matched_request.quantity IS NOT NULL
          AND matched_request.required_to_order IS NULL
          AND matched_request.quantity <> NEW.qty
    THEN
      delta_note := 'הבקשה הופנתה להזמנה אך בכמות שונה: התבקש ' ||
                    matched_request.quantity::text ||
                    ', הוזמן בפועל ' || NEW.qty::text || '.';
      INSERT INTO order_request_comments (request_id, body, created_by, created_by_name, created_by_role)
      VALUES (matched_request.id, delta_note, actor_id, actor_name, 'MANAGER');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
