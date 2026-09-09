-- Goods receipt email (מייל קליטת סחורה)
--
-- Whenever a shipment lands, the product manager mails the receiving clerk a
-- one-row-per-item table — supplier code and name, product code and name,
-- quantity, receipt date, which warehouse to book it into, and who took
-- delivery — with the supplier's invoice attached. Until now that mail was
-- retyped by hand in Outlook for every arrival.
--
-- This table is the record of what was actually sent: it is written only by the
-- send-goods-receipt-email Edge Function (service role), never by the client,
-- so a row here means Resend accepted the message. The table rows are kept as
-- JSONB rather than a child table because they are a snapshot of the mail as it
-- left — later edits to the product or the order must not rewrite history.

CREATE TABLE IF NOT EXISTS public.goods_receipt_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  -- Who pressed send. Kept alongside a denormalised name so the history still
  -- reads correctly after a profile is removed.
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT,

  recipient_email TEXT NOT NULL,
  cc_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,

  -- The shared header values of the mail. Every line carries its own copy in
  -- `lines` (a line may be received on a different day or into another
  -- warehouse); these are what the dialog was set to when it was sent.
  receipt_date DATE,
  warehouse TEXT,
  received_by TEXT,
  note TEXT,

  -- One object per table row, exactly as rendered:
  --   { supplier_code, supplier_name, product_code, product_name,
  --     qty, receipt_date, warehouse, received_by }
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- File names of the purchase_documents attached (usually the invoice).
  attachment_names TEXT[] NOT NULL DEFAULT '{}',

  -- Resend's message id, for tracing a delivery complaint back to a send.
  provider_message_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_emails_order
  ON public.goods_receipt_emails (order_id, created_at DESC);

ALTER TABLE public.goods_receipt_emails ENABLE ROW LEVEL SECURITY;

-- Read-only for the app: the history is shown on the order page. Writes have no
-- policy on purpose — only the Edge Function's service-role key inserts here.
DROP POLICY IF EXISTS "Authenticated users can read goods receipt emails" ON public.goods_receipt_emails;
CREATE POLICY "Authenticated users can read goods receipt emails" ON public.goods_receipt_emails
  FOR SELECT TO authenticated USING (true);

-- The default recipient (the receiving clerk) is configured once in Settings.
-- app_config already holds the Resend credentials, so it is the natural home,
-- but its only policy is manager-all — and the dialog has to show the default
-- to whoever is sending. These two keys hold no secret, so they are readable by
-- any signed-in user while everything else in the table stays manager-only.
INSERT INTO public.app_config (key, value)
VALUES ('goods_receipt_recipient_email', ''),
       ('goods_receipt_cc_emails', ''),
       ('goods_receipt_recipient_name', '')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read goods receipt config" ON public.app_config;
CREATE POLICY "Authenticated users can read goods receipt config" ON public.app_config
  FOR SELECT TO authenticated
  USING (key IN ('goods_receipt_recipient_email', 'goods_receipt_cc_emails', 'goods_receipt_recipient_name'));
