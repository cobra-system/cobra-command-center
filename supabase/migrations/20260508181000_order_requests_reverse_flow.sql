-- Wave 5 part 2: Reverse flow.
--
-- When a manager creates an order line item for a product that has an open
-- pending order_request in any bonded division, automatically:
--   • mark that request as ordered + link it to the order
--   • post a comment if the actual ordered quantity differs from what was requested
-- The request is treated as a recommendation; the order is what actually happened.

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

  -- Find at most one pending request that matches the product across bonded divisions
  -- and is not already linked to an order. If multiple exist (shouldn't, given the
  -- unique constraint per division), pick the oldest (FIFO).
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
        ordered_at = NOW(),
        ordered_by = actor_id,
        ordered_by_name = actor_name,
        actual_ordered_qty = NEW.qty,
        reviewed_at = NOW(),
        reviewed_by = actor_id,
        reviewed_by_name = actor_name
    WHERE id = matched_request.id;

    -- If the actual qty differs from the request, post a comment so the
    -- division manager sees what really happened. The request is a
    -- recommendation; the order is what got placed.
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

DROP TRIGGER IF EXISTS link_pending_order_request_on_order_item_trg ON order_items;
CREATE TRIGGER link_pending_order_request_on_order_item_trg
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION link_pending_order_request_on_order_item();
