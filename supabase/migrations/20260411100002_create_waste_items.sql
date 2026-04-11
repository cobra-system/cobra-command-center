-- Create waste_items table (referenced by WasteManagementPage but was missing from migrations)
-- Also tracks items that came from equipment returns (source='equipment_return')

CREATE TABLE IF NOT EXISTS waste_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name     TEXT NOT NULL,
  sku              TEXT,
  quantity         INTEGER NOT NULL DEFAULT 1,
  in_use           BOOLEAN NOT NULL DEFAULT false,
  recommendations  TEXT,
  -- Source tracking: was this added manually or from equipment return QC?
  source           TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'equipment_return')),
  -- Link back to the return item that triggered this (nullable for manual entries)
  return_item_id   UUID REFERENCES equipment_return_items(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name  TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waste_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON waste_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Also add new change_type values to inventory_change_log (add equipment types to reason tracking)
-- The change_type column has no CHECK constraint — just document via comment
COMMENT ON COLUMN inventory_change_log.change_type IS
  'manual | transfer_out | transfer_in | equipment_pickup | equipment_return';
