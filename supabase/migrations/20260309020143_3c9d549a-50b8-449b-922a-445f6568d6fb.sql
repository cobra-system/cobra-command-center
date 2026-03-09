
-- Junction table for many-to-many compliance_items <-> products
CREATE TABLE public.compliance_product_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compliance_item_id UUID NOT NULL REFERENCES public.compliance_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(compliance_item_id, product_id)
);

ALTER TABLE public.compliance_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance links" ON public.compliance_product_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert compliance links" ON public.compliance_product_links FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can delete compliance links" ON public.compliance_product_links FOR DELETE TO authenticated USING (is_manager());

-- Add ticket_number and diagnostic_source columns to product_issues for the wizard
ALTER TABLE public.product_issues ADD COLUMN IF NOT EXISTS ticket_number TEXT;
ALTER TABLE public.product_issues ADD COLUMN IF NOT EXISTS diagnostic_source TEXT;
ALTER TABLE public.product_issues ADD COLUMN IF NOT EXISTS diagnostic_steps JSONB;
