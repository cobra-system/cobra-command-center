
ALTER TABLE public.purchase_documents ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE public.purchase_documents ALTER COLUMN quantity SET DEFAULT 0;
