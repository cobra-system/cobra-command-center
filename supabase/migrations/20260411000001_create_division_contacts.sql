-- Division contacts: technicians, managers, coordinators per AWACS/כפתור/DOORE
CREATE TABLE division_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division    TEXT NOT NULL,   -- 'AWACS' | 'כפתור' | 'DOORE'
  name        TEXT NOT NULL,
  role        TEXT,            -- 'טכנאי' | 'מנהל' | 'רכז' | 'אחר'
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE division_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON division_contacts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
