-- Order Requests — בקשות הזמנה
-- Bonded division managers create requests; procurement managers fulfill them.

CREATE TABLE order_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  division          TEXT        NOT NULL,
  product_id        UUID        REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT        NOT NULL,
  supplier          TEXT,
  current_consumption TEXT,
  reason            TEXT,
  quantity          NUMERIC     NOT NULL CHECK (quantity > 0),
  urgency           TEXT        NOT NULL DEFAULT 'רגיל' CHECK (urgency IN ('דחוף', 'רגיל', 'נמוך')),
  order_type        TEXT        NOT NULL CHECK (order_type IN ('מיידית', 'חודשית', 'רבעונית', 'חצי שנתית')),
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered')),
  order_id          UUID        REFERENCES orders(id) ON DELETE SET NULL,
  ordered_at        TIMESTAMPTZ,
  ordered_by        UUID        REFERENCES auth.users(id),
  ordered_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES auth.users(id)
);

CREATE INDEX order_requests_division_idx ON order_requests(division);
CREATE INDEX order_requests_status_idx   ON order_requests(status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;

-- Managers see everything; division managers see only their own division
CREATE POLICY "order_requests_select" ON order_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
    OR division = (SELECT division FROM profiles WHERE id = auth.uid())
  );

-- Division managers can insert only for their own division
CREATE POLICY "order_requests_insert" ON order_requests
  FOR INSERT WITH CHECK (
    division = (SELECT division FROM profiles WHERE id = auth.uid())
  );

-- Only managers can update (to fulfill requests)
CREATE POLICY "order_requests_update" ON order_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

-- Only managers can delete
CREATE POLICY "order_requests_delete" ON order_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );
