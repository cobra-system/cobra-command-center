-- Remove division_products for non-bonded divisions (empty data, not in use).
-- Keeps only the 3 bonded divisions: דלק מוטורס, לובינסקי, פריזבי קרסו.
-- Note: לובינסקי division manager (avimars@cobra.co.il) was created via auth admin.
DELETE FROM division_products
WHERE division IN ('AWACS', 'Doore', 'DOORE', 'כפתור');
