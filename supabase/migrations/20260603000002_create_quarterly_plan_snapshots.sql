-- Quarterly plan snapshots — undo/audit for recalculation
CREATE TABLE quarterly_plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  label TEXT NOT NULL,
  notes TEXT,
  payload JSONB NOT NULL,
  total_products INT,
  total_required NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by UUID REFERENCES auth.users(id),
  captured_by_name TEXT
);

CREATE INDEX idx_qps_division ON quarterly_plan_snapshots(division);
CREATE INDEX idx_qps_period ON quarterly_plan_snapshots(year, quarter);

ALTER TABLE quarterly_plan_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read quarterly_plan_snapshots"
  ON quarterly_plan_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "managers write quarterly_plan_snapshots"
  ON quarterly_plan_snapshots FOR ALL TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'MANAGER'
        OR (profiles.division IS NOT NULL AND profiles.division = quarterly_plan_snapshots.division)
      )
    )
  );
