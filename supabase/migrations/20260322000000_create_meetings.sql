-- Meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  participants TEXT,
  summary TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting action items
CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

-- Meetings policies
CREATE POLICY "Authenticated users can read meetings" ON public.meetings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update meetings" ON public.meetings
  FOR UPDATE TO authenticated USING (public.is_manager());
CREATE POLICY "Managers can delete meetings" ON public.meetings
  FOR DELETE TO authenticated USING (public.is_manager());

-- Meeting action items policies
CREATE POLICY "Authenticated users can read meeting action items" ON public.meeting_action_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meeting action items" ON public.meeting_action_items
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "Managers and assignees can update meeting action items" ON public.meeting_action_items
  FOR UPDATE TO authenticated USING (assignee_id = auth.uid() OR public.is_manager());
CREATE POLICY "Managers can delete meeting action items" ON public.meeting_action_items
  FOR DELETE TO authenticated USING (public.is_manager());

-- updated_at trigger (reuses existing function)
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX idx_meeting_action_items_meeting ON public.meeting_action_items(meeting_id);
CREATE INDEX idx_meeting_action_items_assignee ON public.meeting_action_items(assignee_id);
