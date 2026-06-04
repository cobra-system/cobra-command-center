-- Add half-year and quarterly average columns to division_products
ALTER TABLE division_products
  ADD COLUMN IF NOT EXISTS monthly_avg_half_year NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_avg_quarter NUMERIC;

-- Compute half-year average (last 6 months) from consumption history
UPDATE division_products dp
SET monthly_avg_half_year = s.avg_qty
FROM (
  SELECT division, product_id, round(AVG(quantity)::numeric, 2) AS avg_qty
  FROM division_product_consumption
  WHERE month >= (SELECT MAX(month) - INTERVAL '5 months' FROM division_product_consumption)
  GROUP BY division, product_id
) s
WHERE dp.division = s.division AND dp.product_id = s.product_id;

-- Compute quarterly average (last 3 months) from consumption history
UPDATE division_products dp
SET monthly_avg_quarter = s.avg_qty
FROM (
  SELECT division, product_id, round(AVG(quantity)::numeric, 2) AS avg_qty
  FROM division_product_consumption
  WHERE month >= (SELECT MAX(month) - INTERVAL '2 months' FROM division_product_consumption)
  GROUP BY division, product_id
) s
WHERE dp.division = s.division AND dp.product_id = s.product_id;
