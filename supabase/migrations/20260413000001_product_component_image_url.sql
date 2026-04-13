-- Add image_url to product_components for per-component photo capture
ALTER TABLE public.product_components
  ADD COLUMN IF NOT EXISTS image_url text;

-- Create product-images storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Authenticated upload
DROP POLICY IF EXISTS "Auth upload product images" ON storage.objects;
CREATE POLICY "Auth upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated update (replace)
DROP POLICY IF EXISTS "Auth update product images" ON storage.objects;
CREATE POLICY "Auth update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated delete
DROP POLICY IF EXISTS "Auth delete product images" ON storage.objects;
CREATE POLICY "Auth delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
