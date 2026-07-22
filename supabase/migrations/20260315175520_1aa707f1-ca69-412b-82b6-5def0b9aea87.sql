
-- Step 1: Remove duplicate rows in center_inventory, keeping the one with highest quantity
DELETE FROM center_inventory
WHERE id NOT IN (
  SELECT DISTINCT ON (center_id, product_id) id
  FROM center_inventory
  ORDER BY center_id, product_id, quantity DESC
);

-- Step 2: Add unique constraint
ALTER TABLE center_inventory ADD CONSTRAINT center_inventory_center_product_unique UNIQUE (center_id, product_id);
