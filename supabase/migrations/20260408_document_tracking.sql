-- Track document numbers (PI-2026-001) and expiry dates per document

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS expiry_date     date;

CREATE INDEX IF NOT EXISTS idx_purchase_documents_document_number
  ON public.purchase_documents(document_number);
