-- Let the import dossier's document kinds through.
--
-- purchase_documents.document_subtype carries a CHECK listing the allowed
-- values, written before the import module existed. The import upload writes
-- seven kinds that were not on that list, so every one of them was rejected —
-- a dropped batch filed only its bill of lading and packing list, the two
-- kinds that happened to already be allowed, and the rest failed with
-- "violates check constraint purchase_documents_document_subtype_check".
--
-- The existing values are kept: SWIFT confirmations, PI/PO attachments and the
-- older INVOICE/COA/CUSTOMS rows all still validate. This only widens the set,
-- so every row already stored still satisfies it and the constraint can be
-- added validated rather than NOT VALID.

ALTER TABLE public.purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_document_subtype_check;

ALTER TABLE public.purchase_documents
  ADD CONSTRAINT purchase_documents_document_subtype_check
    CHECK (document_subtype = ANY (ARRAY[
      -- Pre-existing kinds.
      'PI', 'PO', 'SWIFT', 'BL', 'PACKING_LIST', 'INVOICE', 'COA', 'CUSTOMS', 'OTHER',
      -- Import dossier kinds — see IMPORT_DOC_SUBTYPES in src/lib/importFiles.ts.
      -- Keep the two lists in step: a value the app can write and the database
      -- rejects loses the document, which is how this constraint was found.
      'COMMERCIAL_INVOICE',
      'DECLARATION',
      'FREIGHT_INVOICE',
      'TERMINAL_INVOICE',
      'FORWARDER_INVOICE',
      'INSURANCE',
      'CERTIFICATE_OF_ORIGIN'
    ]));
