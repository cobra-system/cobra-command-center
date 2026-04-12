-- ============================================================
-- Migration: Create warehouse_zones table + fix warehouse_zone_products RLS
-- ============================================================

-- ── Part A: Fix warehouse_zone_products (the INSERT bug) ────
-- Re-create the table in the public schema explicitly and replace
-- the conflicting FOR ALL + FOR SELECT policy combo with 4 split policies.

CREATE TABLE IF NOT EXISTS public.warehouse_zone_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_id, product_id)
);

ALTER TABLE public.warehouse_zone_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view warehouse zone products"
  ON public.warehouse_zone_products;
DROP POLICY IF EXISTS "Authenticated users can manage warehouse zone products"
  ON public.warehouse_zone_products;

CREATE POLICY "wzp_select"
  ON public.warehouse_zone_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "wzp_insert"
  ON public.warehouse_zone_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wzp_update"
  ON public.warehouse_zone_products FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "wzp_delete"
  ON public.warehouse_zone_products FOR DELETE TO authenticated USING (true);

-- ── Part B: Create warehouse_zones table ────────────────────

CREATE TABLE IF NOT EXISTS public.warehouse_zones (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#9E9E9E',
  text_color     TEXT NOT NULL DEFAULT '#ffffff',
  grid_row       TEXT NOT NULL,       -- CSS grid string, e.g. "1 / 3"
  grid_col       TEXT NOT NULL,       -- CSS grid string, e.g. "1 / 5"
  zone_type      TEXT NOT NULL DEFAULT 'storage',
  icon           TEXT,                -- Lucide icon name, nullable
  is_non_product BOOLEAN NOT NULL DEFAULT false,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wz_select"
  ON public.warehouse_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "wz_insert"
  ON public.warehouse_zones FOR INSERT TO authenticated
  WITH CHECK (public.has_module_edit('logistics-map'));
CREATE POLICY "wz_update"
  ON public.warehouse_zones FOR UPDATE TO authenticated
  USING (public.has_module_edit('logistics-map'));
CREATE POLICY "wz_delete"
  ON public.warehouse_zones FOR DELETE TO authenticated
  USING (public.has_module_edit('logistics-map'));

-- ── Part C: Seed with all 29 hardcoded zones ────────────────

INSERT INTO public.warehouse_zones
  (id, name, color, text_color, grid_row, grid_col, zone_type, icon, is_non_product, sort_order)
VALUES
  -- Right side shelving rack (top to bottom)
  ('light-buttons',        E'כפתור לייט',                    '#4a4a4a', '#ffffff', '1 / 3',  '1 / 5',  'shelving', NULL,       false, 0),
  ('lcd-g4-buttons',       E'כפתור LCD + G4',                '#4a4a4a', '#ffffff', '3 / 5',  '1 / 5',  'shelving', NULL,       false, 1),
  ('phone-stands',         E'מעמדי טלפון\nחישבי בדורם',      '#4a4a4a', '#ffffff', '5 / 7',  '1 / 5',  'shelving', NULL,       false, 2),
  ('head-mounts',          E'תושבת ראש\nמרכז בלוק',          '#4a4a4a', '#ffffff', '7 / 9',  '1 / 5',  'shelving', NULL,       false, 3),
  ('cobratv-screens-1',    E'CobraTv + מסכים',               '#F4A89A', '#1a1a1a', '9 / 11', '1 / 5',  'shelving', NULL,       false, 4),
  ('cobratv-screens-2',    E'CobraTv + מסכים',               '#F4A89A', '#1a1a1a', '11 / 13','1 / 5',  'shelving', NULL,       false, 5),
  ('g4-android-screens-1', E'G4 מסכי אנדרויד',               '#b87333', '#ffffff', '13 / 15','1 / 5',  'shelving', NULL,       false, 6),
  ('g4-android-screens-2', E'G4 מסכי אנדרויד',               '#b87333', '#ffffff', '15 / 17','1 / 5',  'shelving', NULL,       false, 7),
  ('g5-android-screens-1', E'G5 מסכי אנדרויד',               '#b87333', '#ffffff', '17 / 19','1 / 5',  'shelving', NULL,       false, 8),
  ('g5-android-screens-2', E'G5 מסכי אנדרויד',               '#b87333', '#ffffff', '19 / 21','1 / 5',  'shelving', NULL,       false, 9),
  -- Top area
  ('smartphone-stands',    E'מעמדים מעודרים לסמארטפון',       '#c4956a', '#ffffff', '1 / 3',  '5 / 10', 'storage',  NULL,       false, 10),
  ('multimedia-systems',   E'מערכות מולטימדיה שונות',          '#8BC34A', '#1a1a1a', '1 / 3',  '10 / 19','storage',  NULL,       false, 11),
  -- Center-left ID zones
  ('id-storage-1',         E'ID',                             '#8B1A1A', '#ffffff', '5 / 8',  '5 / 8',  'storage',  NULL,       false, 12),
  ('id-storage-2',         E'ID',                             '#8B1A1A', '#ffffff', '5 / 8',  '8 / 10', 'storage',  NULL,       false, 13),
  ('id-storage-3',         E'ID',                             '#8B1A1A', '#ffffff', '5 / 8',  '10 / 12','storage',  NULL,       false, 14),
  -- Center E.R.M zones
  ('erm-1',                E'E.R.M',                          '#FFD600', '#1a1a1a', '8 / 11', '5 / 8',  'product',  NULL,       false, 15),
  ('erm-2',                E'E.R.M',                          '#FFD600', '#1a1a1a', '8 / 11', '8 / 11', 'product',  NULL,       false, 16),
  ('erm-3',                E'E.R.M',                          '#FFD600', '#1a1a1a', '8 / 11', '11 / 14','product',  NULL,       false, 17),
  -- Center-right gray storage
  ('gray-storage-1',       E'אחסון',                          '#9E9E9E', '#ffffff', '3 / 8',  '12 / 15','storage',  NULL,       false, 18),
  ('gray-storage-2',       E'אחסון',                          '#78909C', '#ffffff', '3 / 8',  '15 / 19','storage',  NULL,       false, 19),
  -- Product-specific colored zones
  ('r8',                   E'R8\nבליינד ספורט',               '#3b5fe6', '#ffffff', '8 / 11', '14 / 17','product',  NULL,       false, 20),
  ('ks400',                E'KS400',                          '#22c55e', '#ffffff', '8 / 11', '17 / 19','product',  NULL,       false, 21),
  ('s400',                 E'S400',                           '#f97316', '#ffffff', '8 / 11', '19 / 21','product',  NULL,       false, 22),
  ('z4k',                  E'Z4K',                            '#06b6d4', '#ffffff', '8 / 11', '21 / 23','product',  NULL,       false, 23),
  -- Far left trunk lifter + spare parts
  ('trunk-spare-parts',    E'מרימר תא מטען\nחשמלי\n+\nחלקי חילוף', '#9C27B0', '#ffffff', '1 / 15', '21 / 25','storage', NULL, false, 24),
  -- Bottom zones
  ('erm-bottom',           E'E.R.M',                          '#FFD600', '#1a1a1a', '17 / 21','5 / 8',  'product',  NULL,       false, 25),
  ('safe',                 E'כספת',                           '#3f51b5', '#ffffff', '17 / 21','8 / 10', 'utility',  'Lock',     true,  26),
  ('work-desk',            E'שולחן עבודה',                    '#757575', '#ffffff', '17 / 21','10 / 15','utility',  NULL,       true,  27),
  ('entrance',             E'כניסה למחסן\nלוגיסטר קוברה ת״א', '#BDBDBD', '#424242', '13 / 21','15 / 25','entrance', 'DoorOpen', true,  28)
ON CONFLICT (id) DO NOTHING;

-- ── Part D: Add FK from warehouse_zone_products → warehouse_zones ─
-- Cascade delete so removing a zone cleans up its product assignments.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wzp_zone_fk'
  ) THEN
    ALTER TABLE public.warehouse_zone_products
      ADD CONSTRAINT wzp_zone_fk
      FOREIGN KEY (zone_id) REFERENCES public.warehouse_zones(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- ── Part E: Reload PostgREST schema cache ────────────────────

NOTIFY pgrst, 'reload schema';
