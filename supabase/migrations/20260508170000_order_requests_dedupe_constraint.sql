-- Wave 4: prevent duplicate pending requests for the same product per division.
-- Only enforces when product_id is set (planning rows seeded with NULL stay free).

-- Defensively de-dupe any existing duplicates: keep the newest pending row,
-- delete older pending duplicates with the same (division, product_id).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY division, product_id
           ORDER BY created_at DESC
         ) AS rn
  FROM order_requests
  WHERE status = 'pending' AND product_id IS NOT NULL
)
DELETE FROM order_requests
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Partial unique index: at most one pending row per (division, product_id).
CREATE UNIQUE INDEX IF NOT EXISTS order_requests_pending_per_division_product_uniq
  ON order_requests(division, product_id)
  WHERE status = 'pending' AND product_id IS NOT NULL;
