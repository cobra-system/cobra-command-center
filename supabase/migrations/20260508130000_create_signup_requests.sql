-- Signup requests — accounts that need manager approval before being activated.
-- Anonymous users can INSERT a request via the request-signup Edge Function.
-- Managers (authenticated) can SELECT / UPDATE through the same backend.

CREATE TABLE IF NOT EXISTS public.signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT,
  requested_role TEXT,
  provider TEXT NOT NULL DEFAULT 'email', -- 'email' | 'google'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reject_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signup_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Only one pending request per email at a time.
CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_email_pending_uniq
  ON public.signup_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS signup_requests_status_idx
  ON public.signup_requests (status, created_at DESC);

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- Managers can read all requests.
DROP POLICY IF EXISTS "Managers can read signup_requests" ON public.signup_requests;
CREATE POLICY "Managers can read signup_requests"
  ON public.signup_requests
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'MANAGER'
  ));

-- Managers can update (approve/reject/notes) — actual side-effects (creating
-- the auth user, profile, etc.) happen in the Edge Function with the service
-- role key, so direct updates from the client are limited but harmless.
DROP POLICY IF EXISTS "Managers can update signup_requests" ON public.signup_requests;
CREATE POLICY "Managers can update signup_requests"
  ON public.signup_requests
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'MANAGER'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'MANAGER'
  ));

-- INSERT/DELETE deliberately not granted to anyone via RLS — the Edge
-- Functions use the service role key which bypasses RLS entirely.

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_signup_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_signup_requests_updated_at ON public.signup_requests;
CREATE TRIGGER set_signup_requests_updated_at
  BEFORE UPDATE ON public.signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_signup_requests_updated_at();
