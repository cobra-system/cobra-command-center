
-- SAP sync log table
CREATE TABLE public.sap_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  sap_code text,
  direction text NOT NULL DEFAULT 'pull',
  status text NOT NULL DEFAULT 'success',
  details text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sap_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync log" ON public.sap_sync_log FOR SELECT USING (true);
CREATE POLICY "Managers can insert sync log" ON public.sap_sync_log FOR INSERT WITH CHECK (is_manager());
CREATE POLICY "Managers can delete sync log" ON public.sap_sync_log FOR DELETE USING (is_manager());

-- Add sap_code columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sap_code text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS sap_code text;
ALTER TABLE public.distribution_centers ADD COLUMN IF NOT EXISTS sap_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sap_doc_entry text;
