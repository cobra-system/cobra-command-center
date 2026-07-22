-- Add "התקבל חלקית" (partially received) to the delivery_status check constraint
ALTER TABLE order_requests
  DROP CONSTRAINT IF EXISTS order_requests_delivery_status_check;

ALTER TABLE order_requests
  ADD CONSTRAINT order_requests_delivery_status_check
    CHECK (delivery_status IN ('נשלחה', 'התקבל חלקית', 'התקבלה', 'נקלטה'));

COMMENT ON COLUMN order_requests.delivery_status IS
  'Supply delivery tracking: נשלחה=Shipped, התקבל חלקית=Partially Received, התקבלה=Received, נקלטה=Processed';
