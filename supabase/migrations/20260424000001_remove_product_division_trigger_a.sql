-- Remove Trigger A (products → division_products).
-- Division writes now go through division_products exclusively.
-- Trigger B (division_products → products.division) remains and is the sole sync.
DROP TRIGGER IF EXISTS trg_sync_division_products ON products;
DROP FUNCTION IF EXISTS sync_division_products_from_product();
