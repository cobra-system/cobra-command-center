-- Wave 7 part 3: trigger-driven dispatch of order-request notifications via pg_net.
--
-- Replaces the polling/cron approach with an immediate fire-and-forget HTTP call
-- to the dispatch-order-request-notifications Edge Function whenever a new row
-- lands in notification_queue.
--
-- Configuration is stored in app_config (small two-column table) so the URL +
-- shared token can be set after the migration runs without code changes:
--
--   INSERT INTO app_config (key, value) VALUES
--     ('notifications_dispatcher_url',
--      'https://<project-ref>.supabase.co/functions/v1/dispatch-order-request-notifications'),
--     ('notifications_dispatcher_token', '<service_role_key>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- If either is missing, the trigger no-ops — the queue still accumulates rows
-- and a manual call to the function processes them.

-- pg_net always installs into the `net` schema regardless of WITH SCHEMA.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_manager_all" ON app_config;
CREATE POLICY "ac_manager_all" ON app_config
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE OR REPLACE FUNCTION dispatch_notification_queue_via_pg_net()
RETURNS TRIGGER AS $$
DECLARE
  url   TEXT;
  token TEXT;
BEGIN
  SELECT value INTO url   FROM app_config WHERE key = 'notifications_dispatcher_url';
  SELECT value INTO token FROM app_config WHERE key = 'notifications_dispatcher_token';

  IF url IS NULL OR token IS NULL THEN
    -- Not configured yet; the row stays pending and a manual invocation will pick it up.
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('triggered_by', NEW.id)
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never fail the originating insert because the dispatch hop failed.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dispatch_notification_queue_trg ON notification_queue;
CREATE TRIGGER dispatch_notification_queue_trg
  AFTER INSERT ON notification_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION dispatch_notification_queue_via_pg_net();
