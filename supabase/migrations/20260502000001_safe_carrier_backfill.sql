-- Safe heuristic backfill of tracking_carrier on existing orders.
-- Only marks rows where the format is unambiguous; everything else stays NULL
-- so the user can pick the carrier explicitly via the UI.
--
-- Heuristics (mirrors src/lib/trackingCarrierDetect.ts):
--   1. tracking_number == tclog_reference (after stripping whitespace/dashes) → TCLOG
--   2. tracking_number is a pure 10-digit numeric → DHL Express
--   3. tracking_number is empty but tclog_reference is filled → TCLOG

-- Rule 1: identical numbers in both fields → user copied the TCLOG ref over.
UPDATE public.orders SET tracking_carrier = 'tclog'
WHERE tracking_carrier IS NULL
  AND tracking_number IS NOT NULL
  AND tclog_reference IS NOT NULL
  AND regexp_replace(tracking_number, '[\s-]', '', 'g') =
      regexp_replace(tclog_reference, '[\s-]', '', 'g');

-- Rule 2: 10-digit numeric is the canonical DHL Express format.
UPDATE public.orders SET tracking_carrier = 'dhl'
WHERE tracking_carrier IS NULL
  AND tracking_number ~ '^\d{10}$';

-- Rule 3: only tclog_reference present → carrier is TCLOG by elimination.
UPDATE public.orders SET tracking_carrier = 'tclog'
WHERE tracking_carrier IS NULL
  AND tracking_number IS NULL
  AND tclog_reference IS NOT NULL;
