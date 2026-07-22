-- Audit history for order notes
-- Every time order notes are updated via MCP, the previous value is preserved here

CREATE TABLE IF NOT EXISTS order_notes_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  note_text TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_reason TEXT            -- optional context: "ETA updated", "SWIFT received", etc.
);

CREATE INDEX IF NOT EXISTS idx_order_notes_history_order_id ON order_notes_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_history_changed_at ON order_notes_history(changed_at DESC);

-- RLS: all authenticated users can read history; any authenticated user can insert (MCP uses service role)
ALTER TABLE order_notes_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_notes_history_select" ON order_notes_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_notes_history_insert" ON order_notes_history
  FOR INSERT TO authenticated WITH CHECK (true);
