CREATE TABLE IF NOT EXISTS division_product_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  division TEXT NOT NULL,
  component_id UUID NOT NULL REFERENCES product_components(id) ON DELETE CASCADE,
  division_stock INTEGER NOT NULL DEFAULT 0,
  division_stock_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division, component_id)
);

ALTER TABLE division_product_items ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "dpi_select" ON division_product_items
  FOR SELECT TO authenticated USING (true);

-- Managers have full write access
CREATE POLICY "dpi_manager_all" ON division_product_items
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- Division managers can write their own division only
CREATE POLICY "dpi_own_division" ON division_product_items
  FOR ALL TO authenticated
  USING (division = (SELECT division FROM profiles WHERE id = auth.uid()))
  WITH CHECK (division = (SELECT division FROM profiles WHERE id = auth.uid()));
