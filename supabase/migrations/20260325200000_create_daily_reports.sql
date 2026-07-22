-- Daily Morning Reports table
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  day_name TEXT, -- e.g. "רביעי"

  -- Structured JSON sections
  cobra_updates JSONB DEFAULT '[]'::jsonb,  -- [{order_name, description}]
  action_items JSONB DEFAULT '[]'::jsonb,   -- [{text, priority: "red"|"orange"|"yellow", done: bool}]
  pending_clarifications JSONB DEFAULT '[]'::jsonb, -- [{supplier, issue, resolved: bool}]
  mail_drafts JSONB DEFAULT '[]'::jsonb,    -- [{recipient, subject, body, status: "pending"|"approved"|"sent"}]
  new_files JSONB DEFAULT '[]'::jsonb,      -- [{filename, folder, date}]
  meetings JSONB DEFAULT '[]'::jsonb,       -- [{time, title, topics}]

  -- Summary stats
  total_action_items INTEGER DEFAULT 0,
  total_mail_drafts INTEGER DEFAULT 0,
  total_cobra_updates INTEGER DEFAULT 0,

  -- Metadata
  generated_by TEXT DEFAULT 'claude-scheduled-task',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by date
CREATE INDEX idx_daily_reports_date ON public.daily_reports(report_date DESC);

-- RLS policies (same pattern as other tables)
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.daily_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON public.daily_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
