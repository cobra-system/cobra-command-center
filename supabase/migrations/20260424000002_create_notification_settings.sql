-- Singleton config table for daily digest settings
CREATE TABLE IF NOT EXISTS notification_digest_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Days of week to send: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  include_overdue_orders BOOLEAN NOT NULL DEFAULT true,
  include_upcoming_payments BOOLEAN NOT NULL DEFAULT true,
  -- How many days ahead to look for upcoming payments
  payment_days_ahead INTEGER NOT NULL DEFAULT 3 CHECK (payment_days_ahead BETWEEN 1 AND 30),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed the one config row if table is empty
INSERT INTO notification_digest_config (digest_enabled, days_of_week, include_overdue_orders, include_upcoming_payments, payment_days_ahead)
SELECT true, ARRAY[1,2,3,4,5], true, true, 3
WHERE NOT EXISTS (SELECT 1 FROM notification_digest_config);

-- RLS: only MANAGERs can read/write
ALTER TABLE notification_digest_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_all_digest_config" ON notification_digest_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );

-- Per-recipient table: system users OR external emails
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One of these must be set, not both
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  external_email TEXT,
  external_name TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_one_recipient_source CHECK (
    (profile_id IS NOT NULL AND external_email IS NULL) OR
    (profile_id IS NULL AND external_email IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_profile ON notification_recipients(profile_id);

ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_all_notification_recipients" ON notification_recipients
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
  );
