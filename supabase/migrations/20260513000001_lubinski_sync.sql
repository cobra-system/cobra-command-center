-- ─── Lubinski Base44 sync support ────────────────────────────────────────────
-- Extends the frisbee sync infrastructure to also handle the Lubinski division
-- which uses a different Base44 app (api_key auth, subdomain URL).

-- 1. Extend frisbee_sync_config with api_key auth columns
ALTER TABLE frisbee_sync_config
  ADD COLUMN IF NOT EXISTS api_url       TEXT,   -- full entities base URL (for api_key auth style)
  ADD COLUMN IF NOT EXISTS api_key_value TEXT;   -- header-based API key (alternative to Bearer token)

-- 2. Add tow-hook accessory columns to frisbee_inspections
ALTER TABLE frisbee_inspections
  ADD COLUMN IF NOT EXISTS tow_hook_fixed        BOOLEAN,
  ADD COLUMN IF NOT EXISTS tow_hook_retractable  BOOLEAN;

-- 3. Pre-populate Lubinski's synthetic equipment IDs in the mapping table
--    These map the boolean API fields to human-readable names used in the dashboard
INSERT INTO frisbee_product_mapping (base44_equipment_id, base44_equipment_name)
VALUES
  ('lub-tow-hook-fixed',          'וו גרירה קבוע'),
  ('lub-tow-hook-retractable',    'וו גרירה משתחרר'),
  ('lub-detailing-window-tint',   'חילון'),
  ('lub-detailing-uv-roof',       'UV גג'),
  ('lub-detailing-nano-coating',  'ציפוי נאנו'),
  ('lub-detailing-nano-interior', 'נאנו פנים'),
  ('lub-detailing-ppf-matte',     'PPF מאט'),
  ('lub-detailing-ppf-glossy',    'PPF גלוסי')
ON CONFLICT (base44_equipment_id) DO NOTHING;

-- 4. Register Lubinski API credentials
INSERT INTO frisbee_sync_config (app_id, token, api_url, api_key_value, branch_name, notes)
VALUES (
  'lubinski',
  '',
  'https://cobra-check-10-copy-905b4aed.base44.app/api/entities',
  'fde5fbd1e1c54c50b01f1d5fad91924c',
  'לובינסקי',
  'API קריאה בלבד של לובינסקי — api_key header auth, branch_id קבוע: lubinski'
);
