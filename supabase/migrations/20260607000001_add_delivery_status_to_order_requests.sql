ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IN ('נשלחה', 'התקבלה', 'נקלטה'))
    DEFAULT NULL;

COMMENT ON COLUMN order_requests.delivery_status IS
  'Supply delivery tracking: נשלחה=Shipped, התקבלה=Received, נקלטה=Processed';
