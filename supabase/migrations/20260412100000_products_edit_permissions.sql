-- Allow users with "edit" permission on the "products" module to write product data.
-- Managers retain full access (has_module_edit checks is_manager() first).
-- Reads remain open to all authenticated users (unchanged).

-- ── products ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Managers can insert products" ON public.products;
DROP POLICY IF EXISTS "Managers can update products" ON public.products;
DROP POLICY IF EXISTS "Managers can delete products" ON public.products;

CREATE POLICY "Product editors can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('products'));

CREATE POLICY "Product editors can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (has_module_edit('products'));

CREATE POLICY "Product editors can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (has_module_edit('products'));

-- ── product_components (INSERT & DELETE only; UPDATE already handled) ────────

DROP POLICY IF EXISTS "Managers can insert components" ON public.product_components;
DROP POLICY IF EXISTS "Managers can delete components" ON public.product_components;

CREATE POLICY "Product or inventory editors can insert components"
  ON public.product_components FOR INSERT TO authenticated
  WITH CHECK (has_module_edit('inventory') OR has_module_edit('products'));

CREATE POLICY "Product or inventory editors can delete components"
  ON public.product_components FOR DELETE TO authenticated
  USING (has_module_edit('inventory') OR has_module_edit('products'));
