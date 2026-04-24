ALTER TABLE public.waste_items
  ADD COLUMN IF NOT EXISTS product_id   UUID REFERENCES public.products(id)           ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES public.product_components(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_waste_items_product_id   ON public.waste_items(product_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_component_id ON public.waste_items(component_id);

-- Backfill 1: equipment-return items — join through return_item_id (most reliable)
UPDATE public.waste_items w
SET product_id = r.product_id
FROM public.equipment_return_items r
WHERE w.return_item_id = r.id
  AND w.product_id IS NULL;

-- Backfill 2: manual items whose product_name matches a product
UPDATE public.waste_items w
SET product_id = p.id
FROM public.products p
WHERE w.product_name = p.name
  AND w.product_id IS NULL;

-- Backfill 3: manual items whose product_name matches a component name
UPDATE public.waste_items w
SET component_id = c.id,
    product_id   = c.product_id
FROM public.product_components c
WHERE w.product_name = c.name
  AND w.product_id IS NULL;
