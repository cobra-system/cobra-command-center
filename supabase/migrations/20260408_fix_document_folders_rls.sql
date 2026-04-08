-- Fix: allow all authenticated users to manage document folders
-- The previous "Managers can manage folders" (FOR ALL) policy blocked non-manager
-- users from creating/editing/deleting folders even when they have document edit
-- permission in the frontend.

DROP POLICY IF EXISTS "Managers can manage folders" ON public.document_folders;

CREATE POLICY "Authenticated users can create folders"
  ON public.document_folders FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update folders"
  ON public.document_folders FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete folders"
  ON public.document_folders FOR DELETE TO authenticated
  USING (true);
