-- Add dedicated shipping/logistics fields to orders table
-- Replaces free-text tracking_number for specific identifiers

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pi_number TEXT,
  ADD COLUMN IF NOT EXISTS vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS booking_number TEXT,
  ADD COLUMN IF NOT EXISTS tclog_reference TEXT;

COMMENT ON COLUMN orders.pi_number IS 'Proforma Invoice number from supplier (e.g. PI-2026-001)';
COMMENT ON COLUMN orders.vessel_name IS 'Vessel/ship name (e.g. MSC ISABELLA)';
COMMENT ON COLUMN orders.booking_number IS 'Shipping line booking number or Bill of Lading number';
COMMENT ON COLUMN orders.tclog_reference IS 'tclog freight forwarder reference number';
