-- Extend products table
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS reorder_point integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_sales_avg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_product_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_product_image text DEFAULT NULL;

-- Extend suppliers table
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS backup_supplier_id uuid REFERENCES public.suppliers(id) DEFAULT NULL;

-- Create learning_journal table
CREATE TABLE public.learning_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'למידה',
  linked_type text DEFAULT NULL,
  linked_id uuid DEFAULT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_journal ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read all journal entries
CREATE POLICY "Authenticated users can read journal"
  ON public.learning_journal FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Users can insert their own entries
CREATE POLICY "Users can insert own journal entries"
  ON public.learning_journal FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- RLS: Users can update their own entries, managers can update all
CREATE POLICY "Users can update own or managers all journal"
  ON public.learning_journal FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_manager());

-- RLS: Managers can delete journal entries
CREATE POLICY "Managers can delete journal entries"
  ON public.learning_journal FOR DELETE
  TO authenticated
  USING (is_manager() OR created_by = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_learning_journal_updated_at
  BEFORE UPDATE ON public.learning_journal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();