
-- Add image_url column to product_issues
ALTER TABLE public.product_issues ADD COLUMN image_url text;

-- Create storage bucket for issue images
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-images', 'issue-images', true);

-- Allow authenticated users to upload issue images
CREATE POLICY "Authenticated users can upload issue images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'issue-images');

-- Allow anyone to read issue images (public bucket)
CREATE POLICY "Anyone can read issue images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'issue-images');

-- Allow managers to delete issue images
CREATE POLICY "Managers can delete issue images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'issue-images' AND public.is_manager());
