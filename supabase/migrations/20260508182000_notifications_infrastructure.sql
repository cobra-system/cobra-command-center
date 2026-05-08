-- Wave 5 part 3: notifications infrastructure.
--
-- Two tables:
--   • notification_subscriptions — Web Push endpoint per user-device, plus email opt-in
--   • notification_queue          — pending payloads to be dispatched by the
--                                   dispatch-order-request-notifications Edge Function
--
-- Triggers enqueue rows on order_request lifecycle events:
--   • created   → notify the relevant procurement manager(s)
--   • urgent    → notify the relevant procurement manager(s)
--   • ordered   → notify the requesting division manager
--   • rejected  → notify the requesting division manager
--   • commented → notify the other side of the conversation
--
-- The Edge Function consumes the queue and marks rows delivered (or failed).

-- ─── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel         TEXT         NOT NULL CHECK (channel IN ('email', 'push')),
  -- For push: the JSON push subscription (endpoint, keys.auth, keys.p256dh).
  -- For email: { "email": "..." }
  config          JSONB        NOT NULL,
  user_agent      TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notification_subscriptions_user_idx
  ON notification_subscriptions(user_id, channel) WHERE is_active;

-- One row per (user, channel) — needed for upsert from the client
CREATE UNIQUE INDEX IF NOT EXISTS notification_subscriptions_user_channel_uniq
  ON notification_subscriptions(user_id, channel);

ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ns_select" ON notification_subscriptions;
CREATE POLICY "ns_select" ON notification_subscriptions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

DROP POLICY IF EXISTS "ns_insert" ON notification_subscriptions;
CREATE POLICY "ns_insert" ON notification_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ns_update" ON notification_subscriptions;
CREATE POLICY "ns_update" ON notification_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ns_delete" ON notification_subscriptions;
CREATE POLICY "ns_delete" ON notification_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ─── Queue ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_queue (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient (nullable: the dispatcher fans out to all matching subscribers)
  recipient_user_id UUID       REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role  TEXT,                     -- 'MANAGER' | 'DIVISION_MANAGER' | NULL
  recipient_division TEXT,                  -- when recipient_role = 'DIVISION_MANAGER'
  event_type      TEXT         NOT NULL CHECK (event_type IN (
                    'order_request_created',
                    'order_request_urgent',
                    'order_request_fulfilled',
                    'order_request_rejected',
                    'order_request_commented'
                  )),
  payload         JSONB        NOT NULL,    -- { request_id, product_name, division, ... }
  status          TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts        INTEGER      NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notification_queue_pending_idx
  ON notification_queue(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_queue_recipient_idx
  ON notification_queue(recipient_user_id, created_at DESC);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nq_select" ON notification_queue;
CREATE POLICY "nq_select" ON notification_queue
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR (recipient_role = 'MANAGER' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER'))
    OR (recipient_role = 'DIVISION_MANAGER'
        AND recipient_division = (SELECT division FROM profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "nq_insert" ON notification_queue;
CREATE POLICY "nq_insert" ON notification_queue
  FOR INSERT WITH CHECK (true);  -- triggers (SECURITY DEFINER) and the dispatcher enqueue

-- ─── Enqueue trigger on order_requests ───────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_order_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  payload_json JSONB;
  product_label TEXT;
BEGIN
  product_label := NEW.product_name;
  payload_json := jsonb_build_object(
    'request_id', NEW.id,
    'product_name', NEW.product_name,
    'product_sku', NEW.product_sku,
    'division', NEW.division,
    'urgency', NEW.urgency,
    'status', NEW.status,
    'quantity', NEW.required_to_order,
    'reject_reason', NEW.reject_reason,
    'created_by_name', NEW.created_by_name,
    'ordered_by_name', NEW.ordered_by_name
  );

  IF TG_OP = 'INSERT' THEN
    -- New request → notify all procurement managers
    INSERT INTO notification_queue (recipient_role, event_type, payload)
    VALUES ('MANAGER',
            CASE WHEN NEW.urgency = 'דחוף' THEN 'order_request_urgent' ELSE 'order_request_created' END,
            payload_json);
    RETURN NEW;
  END IF;

  -- Status transitions notify the requesting division
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ordered' THEN
      INSERT INTO notification_queue (recipient_role, recipient_division, event_type, payload)
      VALUES ('DIVISION_MANAGER', NEW.division, 'order_request_fulfilled', payload_json);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notification_queue (recipient_role, recipient_division, event_type, payload)
      VALUES ('DIVISION_MANAGER', NEW.division, 'order_request_rejected', payload_json);
    END IF;
  END IF;

  -- Urgency upgrade to 'דחוף' on a still-pending row → notify managers
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

DROP TRIGGER IF EXISTS enqueue_order_request_notification_trg ON order_requests;
CREATE TRIGGER enqueue_order_request_notification_trg
  AFTER INSERT OR UPDATE OF status, urgency ON order_requests
  FOR EACH ROW EXECUTE FUNCTION enqueue_order_request_notification();

-- ─── Comment notifications ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  request_row order_requests%ROWTYPE;
  payload_json JSONB;
  recipient_role_v TEXT;
BEGIN
  SELECT * INTO request_row FROM order_requests WHERE id = NEW.request_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  payload_json := jsonb_build_object(
    'request_id', NEW.request_id,
    'product_name', request_row.product_name,
    'division', request_row.division,
    'comment_body', NEW.body,
    'comment_author', NEW.created_by_name,
    'comment_role', NEW.created_by_role
  );

  -- Notify the other side: if a MANAGER commented, notify the division;
  -- otherwise notify the procurement managers.
  IF NEW.created_by_role = 'MANAGER' THEN
    INSERT INTO notification_queue (recipient_role, recipient_division, event_type, payload)
    VALUES ('DIVISION_MANAGER', request_row.division, 'order_request_commented', payload_json);
  ELSE
    INSERT INTO notification_queue (recipient_role, event_type, payload)
    VALUES ('MANAGER', 'order_request_commented', payload_json);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enqueue_comment_notification_trg ON order_request_comments;
CREATE TRIGGER enqueue_comment_notification_trg
  AFTER INSERT ON order_request_comments
  FOR EACH ROW EXECUTE FUNCTION enqueue_comment_notification();

-- Realtime publication for in-app toasts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notification_queue') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification_queue;
  END IF;
END $$;
