-- ── Document Folders ─────────────────────────────────────────────────────────
-- Allows users to organize purchase documents into named, colored folders.
-- "Smart folders" (PI / PO / כללי) remain client-side virtual; this table
-- backs user-created custom folders.

CREATE TABLE public.document_folders (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT 'blue',  -- blue|green|orange|purple|red|gray
  created_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folders"
  ON public.document_folders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage folders"
  ON public.document_folders FOR ALL TO authenticated USING (is_manager());

CREATE TRIGGER update_document_folders_updated_at
  BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Extend purchase_documents ─────────────────────────────────────────────────
ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS folder_id  uuid    REFERENCES public.document_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_purchase_documents_folder_id
  ON public.purchase_documents(folder_id);
