
CREATE TABLE public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supplier contacts" ON public.supplier_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert supplier contacts" ON public.supplier_contacts FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update supplier contacts" ON public.supplier_contacts FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete supplier contacts" ON public.supplier_contacts FOR DELETE TO authenticated USING (is_manager());
