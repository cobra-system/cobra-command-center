-- Add destination supplier fields for "בין ספקים" (supplier-to-supplier) transfers
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS destination_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_supplier_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_destination_supplier_id
  ON orders(destination_supplier_id)
  WHERE destination_supplier_id IS NOT NULL;

COMMENT ON COLUMN orders.destination_supplier_id IS 'For inter-supplier transfers (בין ספקים): the receiving supplier';
COMMENT ON COLUMN orders.destination_supplier_name IS 'Denormalized destination supplier name for display without join';
