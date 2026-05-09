-- Wave 7 part 1: normalize utilization_pct to percent (0–100) form.
--
-- Historically rows arrived in mixed forms — some 0.85 (fraction), some 85
-- (percent). The frontend papered over this with `abs(v) <= 1 ? v*100 : v`,
-- which is fragile (e.g. a real 1% reading would render as 100%).
--
-- After this migration, the column always carries a whole-number percentage
-- (or NULL). Frontend reads the value as-is.

UPDATE order_requests
SET utilization_pct = ROUND((utilization_pct * 100)::NUMERIC, 2)
WHERE utilization_pct IS NOT NULL
  AND utilization_pct > 0
  AND utilization_pct <= 1;

-- Floor at 0; no upper bound (a division can be over-committed > 100%)
ALTER TABLE order_requests
  ADD CONSTRAINT order_requests_utilization_pct_nonneg
  CHECK (utilization_pct IS NULL OR utilization_pct >= 0);

COMMENT ON COLUMN order_requests.utilization_pct IS
  'Utilization as a whole-number percentage (e.g. 85 = 85%). May exceed 100 when over-committed.';
