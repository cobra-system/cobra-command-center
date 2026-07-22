-- Allow managers to delete orders and order items
CREATE POLICY "Managers can delete orders" ON public.orders FOR DELETE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete order items" ON public.order_items FOR DELETE TO authenticated USING (is_manager());
CREATE POLICY "Managers can update order items" ON public.order_items FOR UPDATE TO authenticated USING (is_manager());