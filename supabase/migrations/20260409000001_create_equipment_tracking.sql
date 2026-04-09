-- ============================================================
-- Equipment Tracking: Installers, Pickups, and Returns
-- ============================================================

-- Table: installers — מתקינים
CREATE TABLE public.installers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  warehouse_number INTEGER,
  division TEXT NOT NULL DEFAULT 'AWACS',  -- 'AWACS' | 'כפתור' | 'DOORE'
  phone TEXT,
  coordinator TEXT,
  status TEXT NOT NULL DEFAULT 'פעיל',     -- 'פעיל' | 'לא פעיל'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: equipment_pickups — הצטיידויות (header)
CREATE TABLE public.equipment_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id UUID NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  source_email_subject TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: equipment_pickup_items — פריטי הצטיידות
CREATE TABLE public.equipment_pickup_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id UUID NOT NULL REFERENCES public.equipment_pickups(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_numbers TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: equipment_returns — החזרות בלאי (header)
CREATE TABLE public.equipment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id UUID NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  return_date DATE NOT NULL,
  logged_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: equipment_return_items — פריטי החזרה
CREATE TABLE public.equipment_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.equipment_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT 'אחר',          -- 'תקלת התקנה' | 'מוצר פגום' | 'לא תואם רכב' | 'עודף' | 'אחר'
  reason_detail TEXT,
  sticker_label TEXT,
  serial_numbers TEXT[],
  is_actually_faulty BOOLEAN DEFAULT NULL,     -- NULL=לא נבדק, true=פגום, false=תקין (בזבוז)
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.installers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.installers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.equipment_pickups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.equipment_pickups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.equipment_pickups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.equipment_pickup_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.equipment_pickup_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.equipment_pickup_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.equipment_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.equipment_returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.equipment_returns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.equipment_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.equipment_return_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.equipment_return_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_pickups_installer ON public.equipment_pickups(installer_id);
CREATE INDEX idx_pickups_date ON public.equipment_pickups(pickup_date);
CREATE INDEX idx_returns_installer ON public.equipment_returns(installer_id);
CREATE INDEX idx_returns_date ON public.equipment_returns(return_date);
CREATE INDEX idx_return_items_faulty ON public.equipment_return_items(is_actually_faulty);

-- ============================================================
-- Seed Data: 11 Installers
-- ============================================================

INSERT INTO public.installers (name, warehouse_number, division, coordinator, status) VALUES
  ('חיים',    106,  'AWACS',  'סלין',  'פעיל'),
  ('מוחמד',  31,   'AWACS',  'סלין',  'פעיל'),
  ('דור',     102,  'AWACS',  'סלין',  'פעיל'),
  ('לירן',    126,  'AWACS',  'סלין',  'פעיל'),
  ('מאור',    115,  'AWACS',  'סלין',  'פעיל'),
  ('רומן',    112,  'AWACS',  'סלין',  'פעיל'),
  ('עדי',     132,  'AWACS',  'סלין',  'פעיל'),
  ('גימיל',   116,  'AWACS',  'סלין',  'פעיל'),
  ('דניאל',   103,  'AWACS',  'סלין',  'פעיל'),
  ('אריק',    NULL, 'כפתור', 'ליטל',  'פעיל'),
  ('ניב',     NULL, 'כפתור', 'ליטל',  'פעיל');
