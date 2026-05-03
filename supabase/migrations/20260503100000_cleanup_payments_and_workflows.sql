-- Cleanup: unify payment system + remove procurement workflow
--
-- 1. Backfill order_payments rows from legacy orders.payment_status / payment_date
--    so orders previously marked paid via the legacy field keep their paid status.
-- 2. Drop the legacy payment_status / payment_date columns from orders.
-- 3. Drop the procurement workflow tables.

-- ── 1. Backfill ────────────────────────────────────────────────────────────
-- For every order with a legacy paid status and NO corresponding row in order_payments,
-- create an order_payments row reflecting the paid state.
-- Orders without total_price get amount = 1 as a placeholder (CHECK amount > 0);
-- the notes field flags them for manual review.
INSERT INTO public.order_payments
  (order_id, payment_type, amount, currency, status, paid_date, notes)
SELECT
  o.id,
  CASE WHEN o.payment_status = 'שולם פיקדון' THEN 'Deposit' ELSE 'Full' END,
  COALESCE(NULLIF(o.total_price, 0), 1),
  'USD',
  'שולם',
  COALESCE(o.payment_date::date, CURRENT_DATE),
  CASE
    WHEN o.total_price IS NULL OR o.total_price <= 0
      THEN 'הומר אוטומטית מסטטוס תשלום ישן — סכום לא היה זמין, יש לעדכן ידנית'
    ELSE 'הומר אוטומטית מסטטוס תשלום ישן'
  END
FROM public.orders o
LEFT JOIN (SELECT DISTINCT order_id FROM public.order_payments) op
  ON op.order_id = o.id
WHERE o.payment_status IN ('שולם', 'שולם פיקדון')
  AND op.order_id IS NULL;

-- ── 2. Drop legacy payment columns from orders ─────────────────────────────
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_date;

-- ── 3. Drop procurement workflow tables ────────────────────────────────────
DROP TABLE IF EXISTS public.workflow_step_logs;
DROP TABLE IF EXISTS public.workflow_instances;
DROP TABLE IF EXISTS public.workflow_templates;
