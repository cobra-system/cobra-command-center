
-- Inventory transfers history
CREATE TABLE public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_center_id uuid REFERENCES public.distribution_centers(id) ON DELETE SET NULL,
  to_center_id uuid REFERENCES public.distribution_centers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0,
  notes text,
  transferred_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transfers" ON public.inventory_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert transfers" ON public.inventory_transfers FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can delete transfers" ON public.inventory_transfers FOR DELETE TO authenticated USING (is_manager());

-- Add min_stock threshold to center_inventory
ALTER TABLE public.center_inventory ADD COLUMN min_stock integer NOT NULL DEFAULT 0;
