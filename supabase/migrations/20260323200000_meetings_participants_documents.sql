-- Meeting participants junction table
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('profile', 'supplier', 'supplier_contact')),
  participant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, participant_type, participant_id)
);

-- Meeting documents table
CREATE TABLE IF NOT EXISTS public.meeting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

-- Participants policies
CREATE POLICY "Authenticated users can read meeting participants" ON public.meeting_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meeting participants" ON public.meeting_participants
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "Managers can delete meeting participants" ON public.meeting_participants
  FOR DELETE TO authenticated USING (public.is_manager());

-- Documents policies
CREATE POLICY "Authenticated users can read meeting documents" ON public.meeting_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meeting documents" ON public.meeting_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "Managers can delete meeting documents" ON public.meeting_documents
  FOR DELETE TO authenticated USING (public.is_manager());

-- Indexes
CREATE INDEX idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_documents_meeting ON public.meeting_documents(meeting_id);
