-- Add photo_url to equipment_return_items for wear control inspection photos
ALTER TABLE public.equipment_return_items
  ADD COLUMN IF NOT EXISTS photo_url text;
