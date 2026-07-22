-- Monthly consumption history per product per division
-- Used for trend charts and consumption analytics
CREATE TABLE IF NOT EXISTS division_product_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division, product_id, month)
);

-- Monthly average consumption on division_products for quick access
ALTER TABLE division_products
  ADD COLUMN IF NOT EXISTS monthly_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_avg_updated_at TIMESTAMPTZ;

-- RLS
ALTER TABLE division_product_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read consumption"
  ON division_product_consumption FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers can write consumption"
  ON division_product_consumption FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_dpc_division_product
  ON division_product_consumption(division, product_id);

CREATE INDEX IF NOT EXISTS idx_dpc_month
  ON division_product_consumption(month);
