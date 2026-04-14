-- Re-assert center_id on installers (guard against partial failure of 20260411100001)
-- The previous fix migration (20260414200000) re-asserted entity_type but omitted center_id.
ALTER TABLE public.installers
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES distribution_centers(id) ON DELETE SET NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
