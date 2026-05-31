-- ─────────────────────────────────────────────────────────────────────────────
-- Waste Disposition Tracking
-- Creates supplier_returns table and adds disposition columns to waste_items
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── supplier_returns table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_returns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'טיוטה'
                   CHECK (status IN ('טיוטה', 'נשלח', 'התקבל אצל ספק', 'הוסדר')),
  tracking_number  TEXT,
  return_reason    TEXT,
  resolution_type  TEXT CHECK (resolution_type IS NULL OR resolution_type IN ('זיכוי', 'החלפה', 'אחר')),
  resolution_notes TEXT,
  shipped_at       TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  settled_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_returns_supplier_id ON supplier_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_status      ON supplier_returns(status);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_deleted     ON supplier_returns(deleted_at) WHERE deleted_at IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_supplier_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_returns_updated_at
  BEFORE UPDATE ON supplier_returns
  FOR EACH ROW EXECUTE FUNCTION update_supplier_returns_updated_at();

-- Soft-delete trigger (reuses existing soft_delete_handler function)
CREATE TRIGGER supplier_returns_soft_delete
  BEFORE DELETE ON supplier_returns
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete_handler();

-- RLS
ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_returns_select" ON supplier_returns
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "supplier_returns_insert" ON supplier_returns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
  ));

CREATE POLICY "supplier_returns_update" ON supplier_returns
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
  ));

CREATE POLICY "supplier_returns_delete" ON supplier_returns
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER'
  ));

-- ─── New columns on waste_items ───────────────────────────────────────────────

ALTER TABLE waste_items
  ADD COLUMN IF NOT EXISTS disposition_type    TEXT DEFAULT NULL
    CHECK (disposition_type IS NULL OR disposition_type IN ('השמדה', 'החזרה לספק', 'מכירה')),
  ADD COLUMN IF NOT EXISTS disposition_date    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplier_return_id  UUID REFERENCES supplier_returns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_buyer_name     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price          NUMERIC(12,2) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_waste_items_disposition_type   ON waste_items(disposition_type);
CREATE INDEX IF NOT EXISTS idx_waste_items_supplier_return_id ON waste_items(supplier_return_id);
