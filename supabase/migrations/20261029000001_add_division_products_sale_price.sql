-- Per-division customer sale price (a product can sell at a different price in each division)
ALTER TABLE division_products
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2) CHECK (sale_price IS NULL OR sale_price >= 0),
  ADD COLUMN IF NOT EXISTS sale_price_currency TEXT NOT NULL DEFAULT 'ILS';
