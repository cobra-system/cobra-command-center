
-- Create inventory change log table
CREATE TABLE public.inventory_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  center_id uuid REFERENCES public.distribution_centers(id) ON DELETE SET NULL,
  old_quantity integer,
  new_quantity integer,
  change_type text NOT NULL DEFAULT 'manual',
  changed_by text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_change_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read inventory log" ON public.inventory_change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert inventory log" ON public.inventory_change_log FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can delete inventory log" ON public.inventory_change_log FOR DELETE TO authenticated USING (is_manager());

-- Trigger: when center_inventory changes for main center, sync products.stock_qty
CREATE OR REPLACE FUNCTION public.sync_main_center_to_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_main_center boolean;
BEGIN
  SELECT is_main INTO is_main_center FROM distribution_centers WHERE id = NEW.center_id;
  IF is_main_center THEN
    UPDATE products SET stock_qty = NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_center_inv_to_product
AFTER INSERT OR UPDATE OF quantity ON public.center_inventory
FOR EACH ROW EXECUTE FUNCTION public.sync_main_center_to_product();

-- Trigger: when products.stock_qty changes, sync to main center inventory
CREATE OR REPLACE FUNCTION public.sync_product_to_main_center()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_center_id uuid;
BEGIN
  IF OLD.stock_qty IS DISTINCT FROM NEW.stock_qty THEN
    SELECT id INTO main_center_id FROM distribution_centers WHERE is_main = true LIMIT 1;
    IF main_center_id IS NOT NULL THEN
      INSERT INTO center_inventory (center_id, product_id, quantity)
      VALUES (main_center_id, NEW.id, NEW.stock_qty)
      ON CONFLICT (center_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_product_to_center_inv
AFTER UPDATE OF stock_qty ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_to_main_center();
