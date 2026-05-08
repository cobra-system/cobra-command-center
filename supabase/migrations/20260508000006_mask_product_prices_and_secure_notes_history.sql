-- Phase 2 of "hide money/documents from non-MANAGER roles":
-- 1. Tighten SELECT on order_notes_history (was qual=true)
-- 2. Add views products_safe, product_components_safe that NULL the
--    price columns when the caller is not a MANAGER. Frontend reads
--    are routed through these views.
--
-- The base tables keep their existing RLS — the views inherit it via
-- security_invoker=true.

-- ============================================================
-- order_notes_history — close SELECT leak
-- ============================================================
DROP POLICY IF EXISTS "order_notes_history_select" ON public.order_notes_history;

CREATE POLICY "Managers can read order notes history"
  ON public.order_notes_history
  FOR SELECT
  TO authenticated
  USING (is_manager());

-- ============================================================
-- products_safe — masks purchase_price / sale_price
-- ============================================================
CREATE OR REPLACE VIEW public.products_safe
  WITH (security_invoker = true) AS
SELECT
  id,
  category,
  division,
  name,
  description,
  sku,
  product_type,
  supplier,
  supplier_origin,
  shipping,
  CASE WHEN is_manager() THEN purchase_price ELSE NULL::numeric END AS purchase_price,
  monthly_sales,
  monthly_order,
  CASE WHEN is_manager() THEN sale_price     ELSE NULL::numeric END AS sale_price,
  stock_qty,
  incoming_qty,
  notes,
  created_at,
  updated_at,
  sap_code,
  lead_time_days,
  monthly_sales_avg,
  reorder_point,
  end_product_image,
  end_product_url
FROM public.products;

GRANT SELECT ON public.products_safe TO authenticated;

-- ============================================================
-- product_components_safe — masks price
-- ============================================================
CREATE OR REPLACE VIEW public.product_components_safe
  WITH (security_invoker = true) AS
SELECT
  id,
  product_id,
  name,
  sku,
  supplier,
  origin,
  stock_qty,
  CASE WHEN is_manager() THEN price ELSE NULL::numeric END AS price,
  notes,
  image_url
FROM public.product_components;

GRANT SELECT ON public.product_components_safe TO authenticated;
