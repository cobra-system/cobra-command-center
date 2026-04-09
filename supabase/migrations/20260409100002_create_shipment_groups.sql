-- Shipment groups allow linking multiple orders that travel on the same vessel/shipment
-- e.g. the $152K order and the $7,040 refurbish order both on MSC ISABELLA

CREATE TABLE IF NOT EXISTS shipment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- e.g. "MSC ISABELLA - March 2026"
  vessel_name TEXT,              -- Vessel name
  departure_date DATE,           -- ETD from origin port
  arrival_date DATE,             -- ETA at destination port
  booking_number TEXT,           -- Shared booking/BL number for the whole shipment
  tclog_reference TEXT,          -- tclog reference for the shipment
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_shipment_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipment_groups_updated_at
  BEFORE UPDATE ON shipment_groups
  FOR EACH ROW EXECUTE FUNCTION update_shipment_groups_updated_at();

-- Link orders to a shipment group
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipment_group_id UUID REFERENCES shipment_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipment_group_id ON orders(shipment_group_id);

-- RLS
ALTER TABLE shipment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipment_groups_select" ON shipment_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shipment_groups_insert" ON shipment_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
    )
  );

CREATE POLICY "shipment_groups_update" ON shipment_groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
    )
  );

CREATE POLICY "shipment_groups_delete" ON shipment_groups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'MANAGER'
    )
  );
