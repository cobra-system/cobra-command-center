-- Extend order_requests with the planning columns the bonded divisions
-- (e.g. פריזבי קרסו) maintain in their procurement Excel.
--
-- The Excel layout (RTL): תיאור פריט · ספק · מק"ט · מלאי תקין מחסן 1 ·
-- כמות מלאי תקין בפועל · צפי רבעון · % מימוש · עול"ב ·
-- נדרש משוכלל (כולל מלאי ביטחון) · נדרש להזמין ·
-- תאריך הגעת עול"ב · תאריך ביצוע הזמנה · סטאטוס תשלום ·
-- כמות שהוזמנה בפועל · סוג משלוח · תאריך הגעה משוער · הערות
--
-- We also relax `quantity` so a planning row can exist before the division
-- has decided how many to actually order.

-- ─── Schema ────────────────────────────────────────────────────────────────

ALTER TABLE order_requests
  ALTER COLUMN quantity DROP NOT NULL;

ALTER TABLE order_requests
  DROP CONSTRAINT IF EXISTS order_requests_quantity_check;

ALTER TABLE order_requests
  ADD CONSTRAINT order_requests_quantity_check
  CHECK (quantity IS NULL OR quantity >= 0);

-- order_type was NOT NULL with no default; planning rows imported in bulk
-- don't have an order_type yet, so default it to a sensible value.
ALTER TABLE order_requests
  ALTER COLUMN order_type SET DEFAULT 'חודשית';

ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS product_sku             TEXT,
  ADD COLUMN IF NOT EXISTS main_warehouse_stock    NUMERIC,
  ADD COLUMN IF NOT EXISTS division_stock          NUMERIC,
  ADD COLUMN IF NOT EXISTS quarterly_forecast      NUMERIC,
  ADD COLUMN IF NOT EXISTS utilization_pct         NUMERIC,
  ADD COLUMN IF NOT EXISTS incoming_orders         NUMERIC,
  ADD COLUMN IF NOT EXISTS smoothed_required       NUMERIC,
  ADD COLUMN IF NOT EXISTS required_to_order       NUMERIC,
  ADD COLUMN IF NOT EXISTS incoming_arrival_date   DATE,
  ADD COLUMN IF NOT EXISTS order_execution_date    DATE,
  ADD COLUMN IF NOT EXISTS payment_status          TEXT,
  ADD COLUMN IF NOT EXISTS actual_ordered_qty      NUMERIC,
  ADD COLUMN IF NOT EXISTS shipping_type           TEXT,
  ADD COLUMN IF NOT EXISTS estimated_arrival_date  DATE,
  ADD COLUMN IF NOT EXISTS notes                   TEXT;

-- ─── Seed: פריזבי קרסו planning rows from the division's Excel ─────────────

INSERT INTO order_requests (
  division, product_name, supplier, product_sku,
  main_warehouse_stock, division_stock, quarterly_forecast, utilization_pct,
  incoming_orders, smoothed_required, required_to_order,
  incoming_arrival_date, order_execution_date, payment_status,
  actual_ordered_qty, shipping_type, estimated_arrival_date, notes,
  status, urgency, order_type
)
SELECT
  'פריזבי קרסו', d.product_name, d.supplier, d.product_sku,
  d.main_warehouse_stock, d.division_stock, d.quarterly_forecast, d.utilization_pct,
  d.incoming_orders, d.smoothed_required, d.required_to_order,
  d.incoming_arrival_date, d.order_execution_date, d.payment_status,
  d.actual_ordered_qty, d.shipping_type, d.estimated_arrival_date, d.notes,
  'pending', 'רגיל', 'חודשית'
FROM (VALUES
  -- Explicit casts on the first row pin every column's type so later NULLs don't fall back to text
  ('מולטימדיה קליאו 5'::text, 'KAIER'::text, 'KR97046'::text, NULL::numeric, 2::numeric, 0::numeric, 0.7::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::date, NULL::date, NULL::text, NULL::numeric, NULL::text, NULL::date, NULL::text),
  ('מולטימדיה ג''וק', 'KAIER', 'KR9276', NULL, 0, 0, 0, NULL, 0, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מולטימדיה קשקאי', 'KAIER', 'KR9432', NULL, 0, 120, 0.02, NULL, 2.88, 2.88, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מולטימדיה DACIA', 'KAIER', 'KR-TK1258', NULL, 0, 0, 0.01, NULL, 0, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('PROOF', 'PROOF', 'Z4K', NULL, 0, NULL, 0.95, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מסכי אנדרואיד ( בודד )', 'ACE VISION', 'AHM1162T', NULL, 99, 1604, 0.15, NULL, 288.72, 189.72, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מרים שמשות קשקאי', 'קסלאסי', '33QAS001', NULL, 40, 298, 1, NULL, 357.6, 317.6, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מרים שמשות דאסטר', 'קסלאסי', '33DAS001', NULL, 89, 198, 0.01, NULL, 2.376, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('פותח תא מטען דאסטר 3', 'קסלאסי', 'TGDUSTER', NULL, 5, NULL, 0.05, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('שקע טעינה USB', NULL, 'C0006', NULL, 131, 336.72, 1, NULL, 404.064, 273.064, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מצלמת תיעוד חכמה', 'JIMMI', 'JC100', NULL, NULL, 0, 0, NULL, 0, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מצלמת קליפס לדאציה 6V', NULL, 'AL517', NULL, NULL, 0, 0.6, NULL, 0, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מצלמת רוורס קליפס 45 מעלות-לדאציה 6V', NULL, 'AL517', NULL, 122, 225, 1, NULL, 270, 148, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('חיישן קדמי קוברה(קשקאי)', 'VODAFONE', 'F294', NULL, 31, 120, 0.03, NULL, 4.32, 0, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('פותח תא מטען קשקאי', 'road rover', 'TGNQ', NULL, NULL, NULL, 0.05, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('דונגיל 4G', NULL, 'E8372H', NULL, 118, 336.72, 1, NULL, 404.064, 286.064, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, 'להזמין בנוהל מגירה כפולה בכפולות של 200-300 יח'''),
  ('אוזניות בלוטות'' למסכים אחוריים', NULL, 'BT810', NULL, 127, 288.72, 1, NULL, 288.72, 161.72, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מסך פסיבי 12.5'' COBRA TV', NULL, 'COBRA_TV_SCR', NULL, 6, NULL, 0.01, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('ערכה COBRA TV 12.5''', NULL, 'COBRA_TV_SCR', NULL, 6, NULL, 0.01, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('מתאם למשענת ראש צ''רי FX', NULL, 'FXH', NULL, 28, 1064, 0.15, NULL, 159.6, 131.6, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL),
  ('סאב וופר BASSPROGO', 'אדי-JBL', 'JBL056', NULL, 7, NULL, 0.04, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, 'הזמנת מסגרת של ארתור'),
  ('מערכת BLIND SPOT', NULL, 'M305', NULL, 109, NULL, 0.7, NULL, NULL, NULL, NULL::date, NULL::date, NULL, NULL, NULL, NULL::date, NULL)
) AS d (
  product_name, supplier, product_sku,
  main_warehouse_stock, division_stock, quarterly_forecast, utilization_pct,
  incoming_orders, smoothed_required, required_to_order,
  incoming_arrival_date, order_execution_date, payment_status,
  actual_ordered_qty, shipping_type, estimated_arrival_date, notes
)
-- only seed once: skip rows where this SKU already has a non-fulfilled
-- planning row for the division
WHERE NOT EXISTS (
  SELECT 1 FROM order_requests r
  WHERE r.division = 'פריזבי קרסו'
    AND r.product_sku IS NOT DISTINCT FROM d.product_sku
    AND r.product_name = d.product_name
);
