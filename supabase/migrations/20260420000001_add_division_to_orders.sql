-- Add division column to orders table to cache division relationships
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS division TEXT;

-- Backfill division from order_items -> products
-- For each order, find the first product's division from order_items
UPDATE public.orders o
SET division = (
  SELECT p.division
  FROM public.order_items oi
  JOIN public.products p ON oi.product_id = p.id
  WHERE oi.order_id = o.id
  LIMIT 1
)
WHERE o.division IS NULL AND EXISTS (
  SELECT 1 FROM public.order_items WHERE order_id = o.id
);

-- Add index on division for query performance
CREATE INDEX IF NOT EXISTS orders_division_idx ON public.orders(division);

-- RLS Policy: Non-managers can only read orders where division matches their profile division
CREATE POLICY "non_managers_orders_select"
  ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_manager() OR
    division = (SELECT division FROM public.profiles WHERE id = auth.uid())
  );

-- RLS Policy: Managers can read all orders
CREATE POLICY "managers_orders_select"
  ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_manager());

-- RLS Policy: Only managers can insert/update orders
CREATE POLICY "managers_orders_insert"
  ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY "managers_orders_update"
  ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_manager());

-- RLS Policy: Only managers can delete orders
CREATE POLICY "managers_orders_delete"
  ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_manager());
