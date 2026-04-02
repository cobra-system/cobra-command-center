-- Allow authenticated users to insert their own audit log entries
-- (for client-side activity logging via activityLogger.ts)
CREATE POLICY "Authenticated users can insert own audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
