-- Add image upload support to orders
ALTER TABLE orders ADD COLUMN order_image TEXT;

-- Add comment for clarity
COMMENT ON COLUMN orders.order_image IS 'URL to the order image stored in Supabase Storage (product-images bucket)';
