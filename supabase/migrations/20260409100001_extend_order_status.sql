-- Extend order status to include customs clearance pipeline
-- ARRIVED_PORT  → goods reached destination port
-- CUSTOMS_CLEARANCE → under customs processing
-- DELIVERED → released from customs, delivered to warehouse
-- Keeps backward-compatible ARRIVED status

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'PENDING',
    'ORDERED',
    'SHIPPED',
    'ARRIVED_PORT',
    'CUSTOMS_CLEARANCE',
    'DELIVERED',
    'ARRIVED',
    'CANCELLED'
  ));
