-- Per-order payment schedule table
-- Models the actual payment stages for each order:
-- e.g. Deposit 15% upfront, Balance 85% after CAB / before shipment
-- Each row is one payment installment with its own SWIFT reference

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Deposit', 'Balance', 'Full')),
  percentage NUMERIC CHECK (percentage IS NULL OR (percentage > 0 AND percentage <= 100)),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'ILS')),
  due_date DATE,
  paid_date DATE,
  swift_reference TEXT,          -- SWIFT/wire transfer reference number from bank
  status TEXT DEFAULT 'ממתין' CHECK (status IN ('ממתין', 'שולם')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_order_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION update_order_payments_updated_at();

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_status ON order_payments(status);
CREATE INDEX IF NOT EXISTS idx_order_payments_due_date ON order_payments(due_date);

-- RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_payments_select" ON order_payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_payments_insert" ON order_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
    )
  );

CREATE POLICY "order_payments_update" ON order_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('MANAGER', 'LOGISTICS')
    )
  );

CREATE POLICY "order_payments_delete" ON order_payments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'MANAGER'
    )
  );
