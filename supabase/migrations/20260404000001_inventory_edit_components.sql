
-- Allow users with "inventory" or "products" edit permission to UPDATE product_components.
-- Previously only managers could write to this table.
-- INSERT and DELETE remain manager-only (structural changes to the BOM stay privileged).

DROP POLICY IF EXISTS "Managers can update components" ON public.product_components;

CREATE POLICY "Inventory or product editors can update components"
  ON public.product_components FOR UPDATE TO authenticated
  USING (has_module_edit('inventory') OR has_module_edit('products'))
  WITH CHECK (has_module_edit('inventory') OR has_module_edit('products'));
