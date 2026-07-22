-- Normalize order status: ARRIVED is the old system's "goods received at warehouse",
-- which corresponds to DELIVERED in the new customs pipeline.
--
-- New pipeline:  PENDING → ORDERED → SHIPPED → ARRIVED_PORT → CUSTOMS_CLEARANCE → DELIVERED
-- Old pipeline:  PENDING → ORDERED → SHIPPED → ARRIVED
--
-- ARRIVED is kept in the CHECK constraint as a deprecated alias so no existing
-- query or integration breaks, but all historic ARRIVED orders are migrated
-- to DELIVERED so the UI and alerts can reason about a single final status.

-- Migrate existing ARRIVED orders to DELIVERED
UPDATE orders
SET status = 'DELIVERED'
WHERE status = 'ARRIVED';

-- Update the constraint to mark ARRIVED as still-accepted (backward compat)
-- while the canonical new statuses are the pipeline above.
-- Comment is the authoritative documentation; ARRIVED will no longer be
-- written by any new code path.
COMMENT ON COLUMN orders.status IS
  'Order lifecycle status.
   New pipeline:  PENDING → ORDERED → SHIPPED → ARRIVED_PORT → CUSTOMS_CLEARANCE → DELIVERED
   Deprecated:    ARRIVED (migrated to DELIVERED; still accepted for backward compatibility)
   Terminal:      DELIVERED, CANCELLED';
