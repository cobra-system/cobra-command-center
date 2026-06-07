-- ═══════════════════════════════════════════════════════════════════════════════
-- Rebuild Waste Management System
-- Drops old waste tables and rebuilds with production-grade schema.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Wipe old waste data ───────────────────────────────────────────────────
TRUNCATE TABLE waste_items CASCADE;

-- ─── 2. Drop old supplier_returns (cascade removes any dependent FKs) ─────────
DROP TABLE IF EXISTS supplier_returns CASCADE;

-- ─── 3. Remove legacy columns from waste_items ───────────────────────────────
ALTER TABLE waste_items
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS in_use,
  DROP COLUMN IF EXISTS recommendations,
  DROP COLUMN IF EXISTS disposition_type,
  DROP COLUMN IF EXISTS disposition_date,
  DROP COLUMN IF EXISTS supplier_return_id,
  DROP COLUMN IF EXISTS sale_buyer_name,
  DROP COLUMN IF EXISTS supplier_id,
  DROP COLUMN IF EXISTS component_id,
  DROP COLUMN IF EXISTS unit_cost;

-- Drop stale indexes
DROP INDEX IF EXISTS idx_waste_items_disposition_type;
DROP INDEX IF EXISTS idx_waste_items_supplier_return_id;
DROP INDEX IF EXISTS idx_waste_items_supplier_id;

-- ─── 4. Add new columns to waste_items ───────────────────────────────────────
ALTER TABLE waste_items
  ADD COLUMN IF NOT EXISTS condition_notes            TEXT,
  ADD COLUMN IF NOT EXISTS status                     TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS destruction_date           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destruction_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS repair_technician_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repair_expected_date       DATE,
  ADD COLUMN IF NOT EXISTS repair_completed_date      DATE,
  ADD COLUMN IF NOT EXISTS sale_buyer                 TEXT,
  ADD COLUMN IF NOT EXISTS sale_price                 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sale_date                  DATE;
-- photo_url already exists from migration 20260419000002

ALTER TABLE waste_items
  ADD CONSTRAINT waste_items_status_check
  CHECK (status IN ('pending', 'destroyed', 'returning', 'repairing', 'sold'));

-- New indexes
CREATE INDEX IF NOT EXISTS idx_waste_items_product_id  ON waste_items(product_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_status      ON waste_items(status);
CREATE INDEX IF NOT EXISTS idx_waste_items_source      ON waste_items(source);
CREATE INDEX IF NOT EXISTS idx_waste_items_created_at  ON waste_items(created_at DESC);

-- ─── 5. Create waste_supplier_returns ─────────────────────────────────────────
CREATE TABLE waste_supplier_returns (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id               UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status                    TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'shipped', 'delivered', 'settled')),

  -- Shipping
  tracking_number           TEXT,
  tracking_carrier          TEXT NOT NULL DEFAULT 'dhl'
    CHECK (tracking_carrier IN ('dhl', 'other')),

  -- DHL tracking fields (mirrors orders table for widget reuse)
  tracking_status           TEXT,
  tracking_status_code      TEXT,
  tracking_raw_status       TEXT,
  tracking_description      TEXT,
  tracking_eta              TEXT,
  tracking_last_location    TEXT,
  tracking_origin           TEXT,
  tracking_destination      TEXT,
  tracking_events           JSONB DEFAULT '[]'::jsonb,
  tracking_last_event       TEXT,
  tracking_last_synced_at   TIMESTAMPTZ,
  tracking_updated_at       TIMESTAMPTZ,
  tracking_sync_error       TEXT,

  -- Business
  return_reason             TEXT,
  settlement_type           TEXT
    CHECK (settlement_type IS NULL OR settlement_type IN ('rma', 'credit')),
  rma_expected_return_date  DATE,
  credit_amount             NUMERIC(12,2),
  notes                     TEXT,

  -- Audit
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_wsr_supplier_id     ON waste_supplier_returns(supplier_id);
CREATE INDEX idx_wsr_status          ON waste_supplier_returns(status);
CREATE INDEX idx_wsr_tracking_number ON waste_supplier_returns(tracking_number)
  WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_wsr_deleted         ON waste_supplier_returns(deleted_at)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_wsr_created_at      ON waste_supplier_returns(created_at DESC);

CREATE TRIGGER waste_supplier_returns_updated_at
  BEFORE UPDATE ON waste_supplier_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER waste_supplier_returns_soft_delete
  BEFORE DELETE ON waste_supplier_returns
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete_handler();

ALTER TABLE waste_supplier_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wsr_select" ON waste_supplier_returns
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "wsr_insert" ON waste_supplier_returns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
  ));

CREATE POLICY "wsr_update" ON waste_supplier_returns
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
  ));

CREATE POLICY "wsr_delete" ON waste_supplier_returns
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER'
  ));

-- ─── 6. Create waste_return_items junction ────────────────────────────────────
CREATE TABLE waste_return_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     UUID NOT NULL REFERENCES waste_supplier_returns(id) ON DELETE CASCADE,
  waste_item_id UUID NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
  UNIQUE (waste_item_id)
);

CREATE INDEX idx_wri_return_id     ON waste_return_items(return_id);
CREATE INDEX idx_wri_waste_item_id ON waste_return_items(waste_item_id);

ALTER TABLE waste_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wri_all" ON waste_return_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. Storage bucket for waste files ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waste-files', 'waste-files', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "waste_files_upload" ON storage.objects;
DROP POLICY IF EXISTS "waste_files_read"   ON storage.objects;
DROP POLICY IF EXISTS "waste_files_delete" ON storage.objects;

CREATE POLICY "waste_files_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'waste-files');

CREATE POLICY "waste_files_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'waste-files');

CREATE POLICY "waste_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'waste-files' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
    )
  );
