-- Wave 2 of order_requests:
--   • New table: order_request_comments (discussion thread per request)
--   • Audit trigger: populate order_request_history on insert/update with status & key field changes
--   • Realtime publication: order_requests + comments + history

-- ─── Comments thread ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_request_comments (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID         NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  body            TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id),
  created_by_name TEXT,
  created_by_role TEXT
);

CREATE INDEX IF NOT EXISTS order_request_comments_request_idx
  ON order_request_comments(request_id, created_at DESC);

ALTER TABLE order_request_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_request_comments_select" ON order_request_comments;
CREATE POLICY "order_request_comments_select" ON order_request_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_requests r
      WHERE r.id = order_request_comments.request_id
        AND (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
          OR r.division = (SELECT division FROM profiles WHERE id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "order_request_comments_insert" ON order_request_comments;
CREATE POLICY "order_request_comments_insert" ON order_request_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_requests r
      WHERE r.id = request_id
        AND (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
          OR r.division = (SELECT division FROM profiles WHERE id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "order_request_comments_delete" ON order_request_comments;
CREATE POLICY "order_request_comments_delete" ON order_request_comments
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

-- ─── Audit trigger: populate order_request_history ───────────────────────────

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

  -- Status transitions are the most important to log
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

  -- Track edits to key planning fields
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
  IF NEW.division_stock IS DISTINCT FROM OLD.division_stock THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'division_stock', OLD.division_stock::text, NEW.division_stock::text);
  END IF;
  IF NEW.order_execution_date IS DISTINCT FROM OLD.order_execution_date THEN
    INSERT INTO order_request_history (request_id, changed_by, changed_by_name, action, field_name, old_value, new_value)
    VALUES (NEW.id, actor_id, actor_name, 'updated', 'order_execution_date', OLD.order_execution_date::text, NEW.order_execution_date::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_order_request_changes_trg ON order_requests;
CREATE TRIGGER log_order_request_changes_trg
  AFTER INSERT OR UPDATE ON order_requests
  FOR EACH ROW EXECUTE FUNCTION log_order_request_changes();

-- ─── Realtime publication ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_request_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_request_comments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_request_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_request_history;
  END IF;
END $$;
