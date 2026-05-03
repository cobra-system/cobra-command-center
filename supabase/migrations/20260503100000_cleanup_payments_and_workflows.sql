-- Remove legacy payment fields from orders table.
-- Payment tracking is now done exclusively through the order_payments table.
-- Payment status is derived in application code from order_payments.status.

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_date;

-- Remove the procurement workflow feature entirely.
-- The workflow_step_logs table references workflow_instances, so drop it first.
DROP TABLE IF EXISTS public.workflow_step_logs;
DROP TABLE IF EXISTS public.workflow_instances;
DROP TABLE IF EXISTS public.workflow_templates;
