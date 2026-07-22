-- Clarify the relationship between order_payments and supplier_payments.
--
-- ROLE OF EACH TABLE:
--   order_payments   = per-order payment SCHEDULE (installment plan)
--                      e.g. "Deposit 15% due 2026-03-01, Balance 85% before shipment"
--                      Has: order_id, payment_type, amount, percentage, due_date,
--                           swift_reference, status
--                      Source of truth for: "what do I need to pay and when?"
--
--   supplier_payments = historical payment EXECUTION log per supplier
--                       e.g. "Paid $22,800 to Ningbo Supplier on 2026-03-03"
--                       Has: supplier_id, order_id, amount, currency, payment_type
--                       Source of truth for: "what have I actually paid this supplier?"
--
-- INTENDED WORKFLOW:
--   1. Create order → add order_payments rows (deposit + balance schedule)
--   2. When deposit is sent → update order_payment (swift_reference, paid_date, status=שולם)
--   3. Optionally: also record in supplier_payments for supplier-level history
--   4. finance.ts / analytics use supplier_payments for aggregate supplier balance
--   5. order-payments.ts / procurement-agenda use order_payments for order-level tracking
--
-- SYNC: not automatic — recording in supplier_payments is optional/manual.
--       Use create_supplier_payment after marking order_payment as paid to keep both in sync.

-- Add swift_reference to supplier_payments for parity (currently only in order_payments)
ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS swift_reference TEXT;

COMMENT ON COLUMN public.supplier_payments.swift_reference IS
  'SWIFT/wire transfer reference number — matches the swift_reference in order_payments when synced';

-- Add order_payment_id to supplier_payments so a payment execution record can
-- reference the schedule entry it satisfies
ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS order_payment_id UUID
    REFERENCES public.order_payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supplier_payments.order_payment_id IS
  'Links this execution record to the order_payments schedule entry it satisfies (optional)';

CREATE INDEX IF NOT EXISTS idx_supplier_payments_order_payment_id
  ON public.supplier_payments(order_payment_id);
