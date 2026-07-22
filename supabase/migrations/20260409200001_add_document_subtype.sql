-- Add document_subtype to purchase_documents so PI and SWIFT (and other
-- attachments) on the same order are distinguishable without opening each file.
--
-- document_subtype is independent of the existing `type` column (PI | PO):
--   type = PI       → document is a Proforma Invoice
--   type = PO       → document is a Purchase Order
--   subtype = SWIFT → within a PI, this attachment is the SWIFT confirmation
--   subtype = BL    → Bill of Lading
--   etc.
--
-- An order can have multiple files: PI document (type=PI, subtype=PI),
-- a SWIFT confirmation attached to it (type=PI, subtype=SWIFT), a BL
-- received later (type=PI, subtype=BL).

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS document_subtype TEXT
    CHECK (document_subtype IN (
      'PI',            -- Proforma Invoice (default for type=PI)
      'PO',            -- Purchase Order (default for type=PO)
      'SWIFT',         -- SWIFT/wire transfer confirmation from bank
      'BL',            -- Bill of Lading
      'PACKING_LIST',  -- Packing list
      'INVOICE',       -- Commercial invoice
      'COA',           -- Certificate of Analysis / quality cert
      'CUSTOMS',       -- Customs declaration / clearance document
      'OTHER'          -- Other attachment
    ));

-- Back-fill: existing PI rows get subtype=PI, existing PO rows get subtype=PO
UPDATE public.purchase_documents
  SET document_subtype = type
  WHERE document_subtype IS NULL;

COMMENT ON COLUMN public.purchase_documents.document_subtype IS
  'Subtype of document within an order: PI, SWIFT, BL, PACKING_LIST, INVOICE, COA, CUSTOMS, OTHER';

CREATE INDEX IF NOT EXISTS idx_purchase_documents_subtype
  ON public.purchase_documents(document_subtype);
