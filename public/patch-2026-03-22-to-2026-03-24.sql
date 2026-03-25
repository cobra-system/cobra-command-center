-- ============================================================
-- COBRA Operations — Patch: 2026-03-22 to 2026-03-24
-- Run this in the Supabase SQL Editor to apply missing migrations
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- === 1. Task dependencies (Gantt) ===
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on uuid[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON public.tasks USING gin(depends_on);

-- === 2. Meetings ===
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Authenticated users can read meetings') THEN
    CREATE POLICY "Authenticated users can read meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Managers can insert meetings') THEN
    CREATE POLICY "Managers can insert meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Managers can update meetings') THEN
    CREATE POLICY "Managers can update meetings" ON public.meetings FOR UPDATE TO authenticated USING (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Managers can delete meetings') THEN
    CREATE POLICY "Managers can delete meetings" ON public.meetings FOR DELETE TO authenticated USING (public.is_manager());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_action_items' AND policyname = 'Authenticated users can read meeting action items') THEN
    CREATE POLICY "Authenticated users can read meeting action items" ON public.meeting_action_items FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_action_items' AND policyname = 'Managers can insert meeting action items') THEN
    CREATE POLICY "Managers can insert meeting action items" ON public.meeting_action_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_action_items' AND policyname = 'Managers and assignees can update meeting action items') THEN
    CREATE POLICY "Managers and assignees can update meeting action items" ON public.meeting_action_items FOR UPDATE TO authenticated USING (assignee_id = auth.uid() OR public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_action_items' AND policyname = 'Managers can delete meeting action items') THEN
    CREATE POLICY "Managers can delete meeting action items" ON public.meeting_action_items FOR DELETE TO authenticated USING (public.is_manager());
  END IF;
END $$;

CREATE OR REPLACE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON public.meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee ON public.meeting_action_items(assignee_id);

-- === 3. Role Permissions (fixes the reported error) ===
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_key text NOT NULL,
  permission_level text NOT NULL DEFAULT 'none'
    CHECK (permission_level IN ('none', 'view', 'edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Authenticated users can read role permissions') THEN
    CREATE POLICY "Authenticated users can read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Managers can insert role permissions') THEN
    CREATE POLICY "Managers can insert role permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Managers can delete role permissions') THEN
    CREATE POLICY "Managers can delete role permissions" ON public.role_permissions FOR DELETE TO authenticated USING (public.is_manager());
  END IF;
END $$;

-- Apply the fixed UPDATE policy (with WITH CHECK for upsert support)
DROP POLICY IF EXISTS "Managers can update role permissions" ON public.role_permissions;
CREATE POLICY "Managers can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- === 4. Tracking number on orders ===
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);
COMMENT ON COLUMN public.orders.tracking_number IS 'Tracking number for shipment monitoring (e.g., DHL, FedEx, local courier)';

-- === 5. Task advancement log ===
CREATE TABLE IF NOT EXISTS public.task_advancement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_due_date TIMESTAMPTZ,
  new_due_date TIMESTAMPTZ NOT NULL,
  advanced_at TIMESTAMPTZ DEFAULT now(),
  advanced_by TEXT DEFAULT 'system_auto_advance',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_advancement_log_task_id ON public.task_advancement_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_advancement_log_advanced_at ON public.task_advancement_log(advanced_at DESC);

ALTER TABLE public.task_advancement_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_advancement_log' AND policyname = 'Allow authenticated users to read advancement logs') THEN
    CREATE POLICY "Allow authenticated users to read advancement logs" ON public.task_advancement_log FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- === 6. Meeting participants & documents ===
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('profile', 'supplier', 'supplier_contact')),
  participant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, participant_type, participant_id)
);

CREATE TABLE IF NOT EXISTS public.meeting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_participants' AND policyname = 'Authenticated users can read meeting participants') THEN
    CREATE POLICY "Authenticated users can read meeting participants" ON public.meeting_participants FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_participants' AND policyname = 'Managers can insert meeting participants') THEN
    CREATE POLICY "Managers can insert meeting participants" ON public.meeting_participants FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_participants' AND policyname = 'Managers can delete meeting participants') THEN
    CREATE POLICY "Managers can delete meeting participants" ON public.meeting_participants FOR DELETE TO authenticated USING (public.is_manager());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_documents' AND policyname = 'Authenticated users can read meeting documents') THEN
    CREATE POLICY "Authenticated users can read meeting documents" ON public.meeting_documents FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_documents' AND policyname = 'Managers can insert meeting documents') THEN
    CREATE POLICY "Managers can insert meeting documents" ON public.meeting_documents FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_documents' AND policyname = 'Managers can delete meeting documents') THEN
    CREATE POLICY "Managers can delete meeting documents" ON public.meeting_documents FOR DELETE TO authenticated USING (public.is_manager());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_meeting ON public.meeting_documents(meeting_id);

-- === 7. Document-product links ===
CREATE TABLE IF NOT EXISTS public.document_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, product_id)
);

ALTER TABLE public.document_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_products' AND policyname = 'Enable read access for authenticated users') THEN
    CREATE POLICY "Enable read access for authenticated users" ON public.document_products FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_products' AND policyname = 'Enable insert for authenticated users') THEN
    CREATE POLICY "Enable insert for authenticated users" ON public.document_products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_products' AND policyname = 'Enable update for authenticated users') THEN
    CREATE POLICY "Enable update for authenticated users" ON public.document_products FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_products' AND policyname = 'Enable delete for authenticated users') THEN
    CREATE POLICY "Enable delete for authenticated users" ON public.document_products FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_products_document_id ON public.document_products(document_id);
CREATE INDEX IF NOT EXISTS idx_document_products_product_id ON public.document_products(product_id);

-- === 8. Goals ===
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#0e7490',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Authenticated users can read goals') THEN
    CREATE POLICY "Authenticated users can read goals" ON public.goals FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Managers can insert goals') THEN
    CREATE POLICY "Managers can insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Managers can update goals') THEN
    CREATE POLICY "Managers can update goals" ON public.goals FOR UPDATE TO authenticated USING (public.is_manager());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Managers can delete goals') THEN
    CREATE POLICY "Managers can delete goals" ON public.goals FOR DELETE TO authenticated USING (public.is_manager());
  END IF;
END $$;

-- ============================================================
-- Patch complete! The role_permissions error should now be resolved.
-- ============================================================
