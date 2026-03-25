-- Goals table for "מטרת-על" (high-level objectives) used in Gantt view
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#0e7490',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read goals" ON public.goals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert goals" ON public.goals
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update goals" ON public.goals
  FOR UPDATE TO authenticated USING (public.is_manager());
CREATE POLICY "Managers can delete goals" ON public.goals
  FOR DELETE TO authenticated USING (public.is_manager());
