-- Allow division managers to update delivery_status and received_qty
-- on their own division's ordered requests.
-- Managers already have an unrestricted update policy; this adds a narrower
-- one for division managers scoped to their division and "ordered" status.

CREATE POLICY "order_requests_update_delivery_by_division" ON order_requests
  FOR UPDATE USING (
    status = 'ordered'
    AND division = (SELECT division FROM profiles WHERE id = auth.uid())
    AND (SELECT division FROM profiles WHERE id = auth.uid()) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );
