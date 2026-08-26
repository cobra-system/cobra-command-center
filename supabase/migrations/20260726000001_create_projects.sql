-- Projects module: lightweight project & task tracking
-- Two tables: projects (high-level initiatives) and project_tasks (checklist per project)

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- planning | active | on_hold | done
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  color TEXT NOT NULL DEFAULT '#0e7490',
  start_date DATE,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TODO',      -- TODO | IN_PROGRESS | DONE
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);

-- RLS: internal collaborative tool — any authenticated user may read and write.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read projects" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read project tasks" ON public.project_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert project tasks" ON public.project_tasks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project tasks" ON public.project_tasks
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete project tasks" ON public.project_tasks
  FOR DELETE TO authenticated USING (true);
