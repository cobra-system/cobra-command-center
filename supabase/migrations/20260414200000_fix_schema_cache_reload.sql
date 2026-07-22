-- Re-assert entity_type safely (guard if prior migration failed)
ALTER TABLE public.installers
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'technician';

-- Create division_contacts if it doesn't exist
CREATE TABLE IF NOT EXISTS public.division_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division    TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.division_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'division_contacts'
      AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated"
      ON public.division_contacts FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Tell PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
