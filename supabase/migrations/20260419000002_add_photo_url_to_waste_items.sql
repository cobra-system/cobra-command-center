-- Add photo_url to waste_items for documenting waste item condition
ALTER TABLE public.waste_items
  ADD COLUMN IF NOT EXISTS photo_url text;
