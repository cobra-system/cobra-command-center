-- ── issue_updates ─────────────────────────────────────────────────────────────
CREATE TABLE public.issue_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID        NOT NULL REFERENCES public.product_issues(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id),
  author_name TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_issue_updates_issue_id   ON public.issue_updates(issue_id);
CREATE INDEX idx_issue_updates_created_at ON public.issue_updates(created_at DESC);

ALTER TABLE public.issue_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issue_updates_select"
  ON public.issue_updates FOR SELECT TO authenticated USING (true);

CREATE POLICY "issue_updates_insert"
  ON public.issue_updates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "issue_updates_delete"
  ON public.issue_updates FOR DELETE TO authenticated USING (public.is_manager());

-- ── issue_attachments ─────────────────────────────────────────────────────────
CREATE TABLE public.issue_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID        NOT NULL REFERENCES public.product_issues(id) ON DELETE CASCADE,
  file_url    TEXT        NOT NULL,
  file_type   TEXT        NOT NULL CHECK (file_type IN ('image', 'video')),
  file_name   TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_issue_attachments_issue_id ON public.issue_attachments(issue_id);

ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issue_attachments_select"
  ON public.issue_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "issue_attachments_insert"
  ON public.issue_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "issue_attachments_delete"
  ON public.issue_attachments FOR DELETE TO authenticated USING (public.is_manager());

-- ── Storage bucket: issue-media ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-media', 'issue-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "issue_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'issue-media');

CREATE POLICY "issue_media_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'issue-media');

CREATE POLICY "issue_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'issue-media' AND public.is_manager());
