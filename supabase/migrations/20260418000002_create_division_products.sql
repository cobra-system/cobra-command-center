CREATE TABLE IF NOT EXISTS division_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  division TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  field_stock INTEGER NOT NULL DEFAULT 0,
  field_stock_updated_at TIMESTAMPTZ,
  quarterly_demand INTEGER,
  quarterly_demand_updated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division, product_id)
);

ALTER TABLE division_products ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "dp_select" ON division_products
  FOR SELECT TO authenticated USING (true);

-- Managers have full write access
CREATE POLICY "dp_manager_all" ON division_products
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- Division managers can write their own division only
CREATE POLICY "dp_own_division" ON division_products
  FOR ALL TO authenticated
  USING (division = (SELECT division FROM profiles WHERE id = auth.uid()))
  WITH CHECK (division = (SELECT division FROM profiles WHERE id = auth.uid()));
