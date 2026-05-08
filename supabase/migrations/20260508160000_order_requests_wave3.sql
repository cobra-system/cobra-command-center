-- Wave 3 of order_requests:
--   • order_request_attachments — file links per request
--   • order_request_snapshots — point-in-time captures (e.g. quarterly closing)
--   • Auto-task creation when a request goes urgent + pending

-- ─── Attachments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_request_attachments (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID         NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  file_name       TEXT         NOT NULL,
  file_url        TEXT         NOT NULL,
  file_type       TEXT,
  file_size       BIGINT,
  description     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id),
  created_by_name TEXT
);

CREATE INDEX IF NOT EXISTS order_request_attachments_request_idx
  ON order_request_attachments(request_id, created_at DESC);

ALTER TABLE order_request_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_request_attachments_select" ON order_request_attachments;
CREATE POLICY "order_request_attachments_select" ON order_request_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_requests r
      WHERE r.id = order_request_attachments.request_id
        AND (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
          OR r.division = (SELECT division FROM profiles WHERE id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "order_request_attachments_insert" ON order_request_attachments;
CREATE POLICY "order_request_attachments_insert" ON order_request_attachments
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

DROP POLICY IF EXISTS "order_request_attachments_delete" ON order_request_attachments;
CREATE POLICY "order_request_attachments_delete" ON order_request_attachments
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

-- ─── Snapshots ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_request_snapshots (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT         NOT NULL,        -- e.g. "סגירת Q1 2026"
  division        TEXT,                          -- nullable: snapshot can be cross-division
  captured_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  captured_by     UUID         REFERENCES auth.users(id),
  captured_by_name TEXT,
  notes           TEXT,
  total_requests  INTEGER      NOT NULL DEFAULT 0,
  total_required_qty NUMERIC,
  total_estimated_value NUMERIC,
  payload         JSONB        NOT NULL          -- frozen rows
);

CREATE INDEX IF NOT EXISTS order_request_snapshots_division_idx
  ON order_request_snapshots(division, captured_at DESC);

ALTER TABLE order_request_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_request_snapshots_select" ON order_request_snapshots;
CREATE POLICY "order_request_snapshots_select" ON order_request_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
    OR division = (SELECT division FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "order_request_snapshots_insert" ON order_request_snapshots;
CREATE POLICY "order_request_snapshots_insert" ON order_request_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

DROP POLICY IF EXISTS "order_request_snapshots_delete" ON order_request_snapshots;
CREATE POLICY "order_request_snapshots_delete" ON order_request_snapshots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

-- Function: capture all current planning rows for a division (or all) into a snapshot
CREATE OR REPLACE FUNCTION capture_order_request_snapshot(
  p_label    TEXT,
  p_division TEXT DEFAULT NULL,
  p_notes    TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  snap_id  UUID;
  rows     JSONB;
  total_n  INTEGER;
  total_q  NUMERIC;
  total_v  NUMERIC;
  actor_id UUID := auth.uid();
  actor_nm TEXT;
BEGIN
  IF actor_id IS NOT NULL THEN
    SELECT name INTO actor_nm FROM profiles WHERE id = actor_id;
  END IF;

  SELECT
    COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
    COUNT(*),
    SUM(COALESCE(r.required_to_order, r.quantity, 0)),
    SUM(COALESCE(r.required_to_order, r.quantity, 0) * COALESCE(r.estimated_unit_price, 0))
  INTO rows, total_n, total_q, total_v
  FROM order_requests r
  WHERE p_division IS NULL OR r.division = p_division;

  INSERT INTO order_request_snapshots (
    label, division, captured_by, captured_by_name, notes,
    total_requests, total_required_qty, total_estimated_value, payload
  )
  VALUES (
    p_label, p_division, actor_id, actor_nm, p_notes,
    COALESCE(total_n, 0), total_q, total_v, rows
  )
  RETURNING id INTO snap_id;

  RETURN snap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Auto-task creation for urgent pending requests ──────────────────────────

CREATE OR REPLACE FUNCTION create_task_for_urgent_request()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
BEGIN
  -- Only fire when a row becomes (urgency=דחוף AND status=pending) and didn't have a matching task
  IF NEW.status = 'pending' AND NEW.urgency = 'דחוף'
     AND (TG_OP = 'INSERT' OR OLD.urgency IS DISTINCT FROM 'דחוף' OR OLD.status IS DISTINCT FROM 'pending')
  THEN
    task_title := 'בקשת רכש דחופה: ' || NEW.product_name || ' (' || NEW.division || ')';

    -- Only create if a task with the same title is not already open
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE title = task_title AND status IN ('TODO', 'IN_PROGRESS')
    ) THEN
      INSERT INTO tasks (title, description, priority, status, due_date)
      VALUES (
        task_title,
        COALESCE(NEW.reason, 'נדרש לטפל בבקשת רכש דחופה.') ||
          E'\n\nכמות: ' || COALESCE(NEW.required_to_order::text, NEW.quantity::text, '—') ||
          ' · ספק: ' || COALESCE(NEW.supplier, '—'),
        'P0',
        'TODO',
        COALESCE(NEW.order_execution_date::timestamptz, NOW() + INTERVAL '3 days')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_task_for_urgent_request_trg ON order_requests;
CREATE TRIGGER create_task_for_urgent_request_trg
  AFTER INSERT OR UPDATE OF urgency, status ON order_requests
  FOR EACH ROW EXECUTE FUNCTION create_task_for_urgent_request();

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_request_attachments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_request_attachments;
  END IF;
END $$;
