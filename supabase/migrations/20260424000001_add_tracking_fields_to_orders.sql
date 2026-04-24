ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS tracking_last_event TEXT,
  ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.tracking_status IS 'Last known shipment status from carrier API (e.g. transit, delivered, exception)';
COMMENT ON COLUMN public.orders.tracking_last_event IS 'Description of the most recent tracking event from carrier API';
COMMENT ON COLUMN public.orders.tracking_updated_at IS 'Timestamp of last tracking data refresh from carrier API';
