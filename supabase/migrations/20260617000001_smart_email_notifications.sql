-- Smart email notifications:
--   1. Add order_request_received event type (confirmation to the requester)
--   2. Helper function to look up auth.users emails by UUID array
--   3. Update trigger to notify the requester on INSERT

-- ─── 1. Extend event_type constraint ─────────────────────────────────────────

ALTER TABLE notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_event_type_check;

ALTER TABLE notification_queue
  ADD CONSTRAINT notification_queue_event_type_check
  CHECK (event_type IN (
    'order_request_created',
    'order_request_urgent',
    'order_request_received',
    'order_request_fulfilled',
    'order_request_rejected',
    'order_request_commented'
  ));

-- ─── 2. Helper: fetch emails from auth.users for the dispatcher ───────────────
-- The Edge Function calls this via supabase.rpc() with service-role key, so it
-- has permission to read auth.users. SECURITY DEFINER runs as the definer's
-- search_path including the auth schema.

CREATE OR REPLACE FUNCTION get_user_emails(user_ids UUID[])
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id, email::TEXT
  FROM auth.users
  WHERE id = ANY(user_ids)
    AND email IS NOT NULL
    AND email <> '';
$$;

-- ─── 3. Update trigger to also notify the requester ──────────────────────────

CREATE OR REPLACE FUNCTION enqueue_order_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  payload_json JSONB;
BEGIN
  payload_json := jsonb_build_object(
    'request_id',      NEW.id,
    'product_name',    NEW.product_name,
    'product_sku',     NEW.product_sku,
    'division',        NEW.division,
    'urgency',         NEW.urgency,
    'status',          NEW.status,
    'quantity',        NEW.required_to_order,
    'reject_reason',   NEW.reject_reason,
    'created_by_name', NEW.created_by_name,
    'ordered_by_name', NEW.ordered_by_name,
    'order_type',      NEW.order_type,
    'supplier',        NEW.supplier
  );

  IF TG_OP = 'INSERT' THEN
    -- Notify procurement managers
    INSERT INTO notification_queue (recipient_role, event_type, payload)
    VALUES (
      'MANAGER',
      CASE WHEN NEW.urgency = 'דחוף' THEN 'order_request_urgent' ELSE 'order_request_created' END,
      payload_json
    );

    -- Confirm to the requester that the request was submitted
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO notification_queue (recipient_user_id, event_type, payload)
      VALUES (NEW.created_by, 'order_request_received', payload_json);
    END IF;

    RETURN NEW;
  END IF;

  -- Status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ordered' THEN
      INSERT INTO notification_queue (recipient_role, recipient_division, event_type, payload)
      VALUES ('DIVISION_MANAGER', NEW.division, 'order_request_fulfilled', payload_json);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notification_queue (recipient_role, recipient_division, event_type, payload)
      VALUES ('DIVISION_MANAGER', NEW.division, 'order_request_rejected', payload_json);
    END IF;
  END IF;

  -- Urgency upgrade to 'דחוף' on a pending row
  IF OLD.urgency IS DISTINCT FROM NEW.urgency
     AND NEW.urgency = 'דחוף'
     AND NEW.status = 'pending'
  THEN
    INSERT INTO notification_queue (recipient_role, event_type, payload)
    VALUES ('MANAGER', 'order_request_urgent', payload_json);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
