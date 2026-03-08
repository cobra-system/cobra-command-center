
-- Table: supplier_price_quotes (supplier comparison)
CREATE TABLE public.supplier_price_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  product_id uuid REFERENCES public.products(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  unit_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  moq integer,
  lead_time_days integer,
  valid_until date,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_price_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quotes" ON public.supplier_price_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert quotes" ON public.supplier_price_quotes FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update quotes" ON public.supplier_price_quotes FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete quotes" ON public.supplier_price_quotes FOR DELETE TO authenticated USING (is_manager());

CREATE TRIGGER update_supplier_price_quotes_updated_at BEFORE UPDATE ON public.supplier_price_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
