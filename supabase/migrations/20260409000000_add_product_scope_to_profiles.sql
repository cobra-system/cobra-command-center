-- Add product-level scoping: when non-null, restricts user to only these product IDs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_product_ids text[] DEFAULT NULL;
COMMENT ON COLUMN profiles.allowed_product_ids IS 'When non-null, restricts user to only these product IDs and related data';
