-- ── Part A: Add notes column to warehouse_zones ───────────────────────────────
ALTER TABLE public.warehouse_zones
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- ── Part B: Create warehouse_zone_log table ───────────────────────────────────
-- Immutable audit trail for zone changes (create/update/delete/move).
-- zone_id is TEXT (not FK) so log entries survive zone deletion.
CREATE TABLE IF NOT EXISTS public.warehouse_zone_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete', 'move')),
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_zone_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wzl_select" ON public.warehouse_zone_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wzl_insert" ON public.warehouse_zone_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- No update/delete policies — the log is append-only.

-- Index for fast per-zone lookups
CREATE INDEX IF NOT EXISTS idx_wzl_zone_id
  ON public.warehouse_zone_log (zone_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
