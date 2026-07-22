-- Create warehouse_zone_products table for mapping products to warehouse map zones
CREATE TABLE IF NOT EXISTS warehouse_zone_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_id, product_id)
);

ALTER TABLE warehouse_zone_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view warehouse zone products"
  ON warehouse_zone_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage warehouse zone products"
  ON warehouse_zone_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
