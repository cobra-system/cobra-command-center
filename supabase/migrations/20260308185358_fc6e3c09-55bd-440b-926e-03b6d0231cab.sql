-- Allow managers to delete products
CREATE POLICY "Managers can delete products" ON public.products FOR DELETE TO authenticated USING (is_manager());

-- Allow managers to delete components
CREATE POLICY "Managers can delete components" ON public.product_components FOR DELETE TO authenticated USING (is_manager());