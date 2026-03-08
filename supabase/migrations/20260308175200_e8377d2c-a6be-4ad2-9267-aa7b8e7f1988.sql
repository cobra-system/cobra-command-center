
-- Table: purchase_documents (PI/PO)
CREATE TABLE public.purchase_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('PI', 'PO')),
  supplier_id uuid REFERENCES public.suppliers(id),
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric,
  total_price numeric,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'ILS')),
  status text NOT NULL DEFAULT 'ממתין לאישור',
  approval_date timestamptz,
  approved_by uuid,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents" ON public.purchase_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert documents" ON public.purchase_documents FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update documents" ON public.purchase_documents FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete documents" ON public.purchase_documents FOR DELETE TO authenticated USING (is_manager());

CREATE TRIGGER update_purchase_documents_updated_at BEFORE UPDATE ON public.purchase_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: supplier_payments
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  order_id uuid REFERENCES public.orders(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_type text NOT NULL DEFAULT 'Full' CHECK (payment_type IN ('Deposit', 'Balance', 'Full')),
  status text NOT NULL DEFAULT 'ממתין',
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read payments" ON public.supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert payments" ON public.supplier_payments FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update payments" ON public.supplier_payments FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete payments" ON public.supplier_payments FOR DELETE TO authenticated USING (is_manager());

CREATE TRIGGER update_supplier_payments_updated_at BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: product_issues
CREATE TABLE public.product_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  reported_date date NOT NULL DEFAULT CURRENT_DATE,
  reporter text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'בינוני' CHECK (severity IN ('נמוך', 'בינוני', 'גבוה', 'קריטי')),
  status text NOT NULL DEFAULT 'פתוח' CHECK (status IN ('פתוח', 'בטיפול', 'נסגר')),
  resolution text,
  resolved_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read issues" ON public.product_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert issues" ON public.product_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Managers can update issues" ON public.product_issues FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete issues" ON public.product_issues FOR DELETE TO authenticated USING (is_manager());

CREATE TRIGGER update_product_issues_updated_at BEFORE UPDATE ON public.product_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
