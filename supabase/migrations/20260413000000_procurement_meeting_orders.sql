-- Add type to meetings table
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general'
  CHECK (type IN ('procurement', 'general', 'other'));

-- Add status to meetings table
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'closed'));

-- Procurement meeting orders junction table
CREATE TABLE IF NOT EXISTS public.procurement_meeting_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL DEFAULT 'pending'
              CHECK (decision IN ('approved', 'deferred', 'partial', 'pending')),
  approved_amount NUMERIC,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, order_id)
);

-- RLS
ALTER TABLE public.procurement_meeting_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read procurement meeting orders"
  ON public.procurement_meeting_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert procurement meeting orders"
  ON public.procurement_meeting_orders
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update procurement meeting orders"
  ON public.procurement_meeting_orders
  FOR UPDATE TO authenticated USING (public.is_manager());

CREATE POLICY "Managers can delete procurement meeting orders"
  ON public.procurement_meeting_orders
  FOR DELETE TO authenticated USING (public.is_manager());

-- updated_at trigger
CREATE TRIGGER update_procurement_meeting_orders_updated_at
  BEFORE UPDATE ON public.procurement_meeting_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_procurement_meeting_orders_meeting ON public.procurement_meeting_orders(meeting_id);
CREATE INDEX idx_procurement_meeting_orders_order   ON public.procurement_meeting_orders(order_id);
