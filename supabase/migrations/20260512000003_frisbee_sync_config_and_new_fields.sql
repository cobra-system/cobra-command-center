-- ─── frisbee_sync_config ─────────────────────────────────────────────────────
-- Stores Base44 API credentials for each synced app.
-- Accessible to service role only (edge functions read from here).

CREATE TABLE IF NOT EXISTS frisbee_sync_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        TEXT NOT NULL,
  token         TEXT NOT NULL,
  branch_name   TEXT NOT NULL,           -- human label, maps to FRISBEE_BASE44_BRANCHES
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service role can read/write
ALTER TABLE frisbee_sync_config ENABLE ROW LEVEL SECURITY;
-- No RLS policies → all access blocked for anon/authenticated; service role bypasses RLS

-- Yaki's credentials (read-only token for פריזבי קרסו)
INSERT INTO frisbee_sync_config (app_id, token, branch_name, notes)
VALUES (
  '68e1b17dc9842a25510b1e52',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ5YWtpb3ZlZEBnbWFpbC5jb20iLCJleHAiOjE3ODQyNDY0MjEsImlhdCI6MTc3NjQ3MDQyMX0.Xj8p5kJkJvdiCGKGBivU423UjP3Sdpy4y9mUSZSwe_A',
  'פריזבי קרסו',
  'Token של יקי (yakioved@gmail.com) — read-only, תוקף עד ~2026-07'
);

-- ─── New fields on frisbee_inspections ───────────────────────────────────────
-- Added for future use; not displayed in UI yet.

ALTER TABLE frisbee_inspections
  ADD COLUMN IF NOT EXISTS protection_provider     TEXT,
  ADD COLUMN IF NOT EXISTS diagnostics_code        TEXT,
  ADD COLUMN IF NOT EXISTS diagnostics_report_url  TEXT,
  ADD COLUMN IF NOT EXISTS is_all_ok               BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_window_tint   BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_nano_coating  BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_ppf_matte     BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_ppf_glossy    BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_ppf_interior  BOOLEAN,
  ADD COLUMN IF NOT EXISTS detailing_uv_roof       BOOLEAN;
