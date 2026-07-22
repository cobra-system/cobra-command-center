-- Enhance tracking fields on orders for richer DHL data + TCLOG carrier identification.
-- Keeps legacy tracking_status / tracking_last_event / tracking_updated_at intact.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_carrier TEXT
    CHECK (tracking_carrier IN ('dhl','tclog','other')),
  ADD COLUMN IF NOT EXISTS tracking_status_code TEXT,
  ADD COLUMN IF NOT EXISTS tracking_raw_status TEXT,
  ADD COLUMN IF NOT EXISTS tracking_description TEXT,
  ADD COLUMN IF NOT EXISTS tracking_eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_last_location TEXT,
  ADD COLUMN IF NOT EXISTS tracking_origin TEXT,
  ADD COLUMN IF NOT EXISTS tracking_destination TEXT,
  ADD COLUMN IF NOT EXISTS tracking_events JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracking_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_sync_error TEXT;

COMMENT ON COLUMN public.orders.tracking_carrier IS 'Carrier providing the tracking data: dhl | tclog | other';
COMMENT ON COLUMN public.orders.tracking_status_code IS 'Normalized status: pre-transit | transit | delivered | failure | unknown';
COMMENT ON COLUMN public.orders.tracking_raw_status IS 'Raw status string from the carrier API (e.g. DHL Express numeric code "102")';
COMMENT ON COLUMN public.orders.tracking_description IS 'Human-readable carrier description for the latest status';
COMMENT ON COLUMN public.orders.tracking_eta IS 'Estimated time of delivery as reported by the carrier';
COMMENT ON COLUMN public.orders.tracking_last_location IS 'City / locality where the most recent event was recorded';
COMMENT ON COLUMN public.orders.tracking_origin IS 'Origin location (city / country) reported by the carrier';
COMMENT ON COLUMN public.orders.tracking_destination IS 'Destination location (city / country) reported by the carrier';
COMMENT ON COLUMN public.orders.tracking_events IS 'Recent tracking events as JSONB array: [{timestamp, code, description, location}]';
COMMENT ON COLUMN public.orders.tracking_last_synced_at IS 'Timestamp when the carrier API was last contacted (success or failure)';
COMMENT ON COLUMN public.orders.tracking_sync_error IS 'Error code/message from the most recent failed sync attempt';

CREATE INDEX IF NOT EXISTS idx_orders_tracking_sync
  ON public.orders(tracking_last_synced_at)
  WHERE tracking_number IS NOT NULL;

-- NOTE: tracking_carrier is intentionally left NULL for existing rows. A
-- tracking_number can be either a DHL waybill or a TCLOG reference, and we
-- can't reliably infer which. Users must set the carrier per order via the UI
-- before any carrier-specific API call is attempted.
