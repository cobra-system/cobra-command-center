-- Link SWIFT confirmations to the payment installment they settle.
--
-- Until now a SWIFT confirmation could only live as a free-floating
-- purchase_documents row (type=כללי, document_subtype=SWIFT) attached to an
-- order, while the payment schedule (order_payments) only held the textual
-- swift_reference. This adds the missing link so a SWIFT file uploaded from
-- the payment schedule lands in the documents module *and* stays attached to
-- the installment it paid.
--
-- Direction of the link: purchase_documents → order_payments (many-to-one),
-- because a single installment can end up with more than one bank document
-- (an amendment, a corrected confirmation, a fee advice).

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS order_payment_id UUID
    REFERENCES public.order_payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.purchase_documents.order_payment_id IS
  'Payment installment (order_payments) this document settles — used for SWIFT confirmations uploaded from the order payment schedule';

CREATE INDEX IF NOT EXISTS idx_purchase_documents_order_payment_id
  ON public.purchase_documents(order_payment_id)
  WHERE order_payment_id IS NOT NULL;

-- The original CHECK on purchase_documents.type only allowed PI/PO, but the
-- app has been writing 'כללי' for general attachments (SWIFT confirmations
-- among them) for a long time. Re-state the constraint to match reality.
-- NOT VALID: only new/updated rows are checked, so any legacy row with an
-- unexpected type value does not block this migration.
ALTER TABLE public.purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_type_check;

ALTER TABLE public.purchase_documents
  ADD CONSTRAINT purchase_documents_type_check
    CHECK (type IN ('PI', 'PO', 'כללי')) NOT VALID;
