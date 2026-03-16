ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'ממתין';

-- Backfill: orders with payment_date get 'שולם'
UPDATE public.orders SET payment_status = 'שולם' WHERE payment_date IS NOT NULL AND payment_status = 'ממתין';