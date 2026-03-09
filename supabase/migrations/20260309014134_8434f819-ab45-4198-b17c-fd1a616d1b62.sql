
CREATE TABLE public.compliance_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'אישורים',
  expiry_date DATE,
  renewal_contact TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance items"
  ON public.compliance_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert compliance items"
  ON public.compliance_items FOR INSERT
  TO authenticated
  WITH CHECK (is_manager());

CREATE POLICY "Managers can update compliance items"
  ON public.compliance_items FOR UPDATE
  TO authenticated
  USING (is_manager());

CREATE POLICY "Managers can delete compliance items"
  ON public.compliance_items FOR DELETE
  TO authenticated
  USING (is_manager());
