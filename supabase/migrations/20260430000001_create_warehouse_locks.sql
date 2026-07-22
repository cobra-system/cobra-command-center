-- ═══════════════════════════════════════════════════════════════════════════
-- Warehouse Lock Control — בקרת נעילה
-- ═══════════════════════════════════════════════════════════════════════════
-- Tracks open/close status of physical locks at the Cobra Tel Aviv site.
-- Workers scan a printed QR code next to each lock to toggle its status.
-- An append-only scan log captures who scanned what and when.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Part A: warehouse_locks — static reference for the 10 physical locks ───
CREATE TABLE IF NOT EXISTS public.warehouse_locks (
  id              SMALLINT    PRIMARY KEY,
  name            TEXT        NOT NULL,
  barcode_value   TEXT        NOT NULL UNIQUE,
  site            TEXT        NOT NULL DEFAULT 'cobra-tel-aviv',
  sort_order      SMALLINT    NOT NULL,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  current_status  TEXT        NOT NULL DEFAULT 'unknown'
                              CHECK (current_status IN ('open', 'closed', 'unknown')),
  last_scan_at    TIMESTAMPTZ,
  last_scan_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wl_select" ON public.warehouse_locks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wl_update" ON public.warehouse_locks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Only managers can insert/delete (configure) locks
CREATE POLICY "wl_insert_manager" ON public.warehouse_locks
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'MANAGER')
  );

CREATE POLICY "wl_delete_manager" ON public.warehouse_locks
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'MANAGER')
  );

-- ── Part B: warehouse_lock_scans — append-only audit log ──────────────────
CREATE TABLE IF NOT EXISTS public.warehouse_lock_scans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id       SMALLINT    NOT NULL REFERENCES public.warehouse_locks(id) ON DELETE CASCADE,
  action        TEXT        NOT NULL CHECK (action IN ('open', 'close')),
  scanned_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  barcode_value TEXT        NOT NULL,
  method        TEXT        NOT NULL DEFAULT 'camera'
                            CHECK (method IN ('camera', 'manual')),
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_lock_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wls_select" ON public.warehouse_lock_scans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wls_insert" ON public.warehouse_lock_scans
  FOR INSERT TO authenticated WITH CHECK (true);

-- No update/delete policies — append-only

CREATE INDEX IF NOT EXISTS idx_wls_lock_id_scanned_at
  ON public.warehouse_lock_scans (lock_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_wls_scanned_at
  ON public.warehouse_lock_scans (scanned_at DESC);

-- ── Part C: Seed the 10 locks for Cobra Tel Aviv ──────────────────────────
-- Barcode values use a stable, readable, namespaced format so a worker can
-- visually verify the QR matches the intended lock if needed.
INSERT INTO public.warehouse_locks (id, name, barcode_value, sort_order) VALUES
  (1,  'שער ראשי',                'COBRA-TLV-LOCK-01', 1),
  (2,  'כניסה ראשית',              'COBRA-TLV-LOCK-02', 2),
  (3,  'מרכז שירות לוגיסטי',       'COBRA-TLV-LOCK-03', 3),
  (4,  'משרד מנהל לוגיסטיקה',     'COBRA-TLV-LOCK-04', 4),
  (5,  'דלת חיצונית מרכז אכסנה',   'COBRA-TLV-LOCK-05', 5),
  (6,  'דלת פנימית מרכז אכסנה',    'COBRA-TLV-LOCK-06', 6),
  (7,  'חלון מרכז אכסנה',          'COBRA-TLV-LOCK-07', 7),
  (8,  'מחסן השמדה',                'COBRA-TLV-LOCK-08', 8),
  (9,  'דלת מזכירות',                'COBRA-TLV-LOCK-09', 9),
  (10, 'מעבדה',                      'COBRA-TLV-LOCK-10', 10)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
