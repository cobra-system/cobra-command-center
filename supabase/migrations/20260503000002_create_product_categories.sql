-- ─────────────────────────────────────────────────────────────────────────────
-- product_categories — editable list of product categories
-- Default categories are seeded here and marked is_default = true.
-- Custom categories added by managers have is_default = false.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  is_default BOOLEAN     NOT NULL DEFAULT false,
  sort_order SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed built-in categories
INSERT INTO public.product_categories (name, is_default, sort_order) VALUES
  ('מיגון ואיתור',     true, 1),
  ('מולטימדיה',        true, 2),
  ('בטיחות',           true, 3),
  ('נוחות וקישוריות',  true, 4),
  ('בית',              true, 5)
ON CONFLICT (name) DO NOTHING;

-- RLS: all authenticated users can read; only MANAGERs can write
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_select" ON public.product_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pc_insert" ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

CREATE POLICY "pc_update" ON public.product_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

CREATE POLICY "pc_delete" ON public.product_categories
  FOR DELETE TO authenticated
  USING (
    NOT is_default AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );
