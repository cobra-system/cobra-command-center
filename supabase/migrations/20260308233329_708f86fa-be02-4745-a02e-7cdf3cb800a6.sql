
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to hash PINs using bcrypt
CREATE OR REPLACE FUNCTION public.hash_pin(raw_pin TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT crypt(raw_pin, gen_salt('bf'))
$$;

-- Create a function to verify PINs against hashed values
CREATE OR REPLACE FUNCTION public.verify_pin(raw_pin TEXT, hashed_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT hashed_pin = crypt(raw_pin, hashed_pin)
$$;

-- Create a secure function to look up a user by PIN (avoids plaintext comparison in client)
CREATE OR REPLACE FUNCTION public.login_by_pin(input_pin TEXT)
RETURNS TABLE(id UUID, name TEXT, role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.role
  FROM public.profiles p
  WHERE public.verify_pin(input_pin, p.pin)
  LIMIT 1;
END;
$$;

-- Hash all existing plaintext PINs
UPDATE public.profiles
SET pin = public.hash_pin(pin)
WHERE pin IS NOT NULL AND length(pin) = 4;

-- Create a login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Index for fast lookup by IP and time
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at);

-- Enable RLS on login_attempts (only edge functions with service role can access)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Make documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'documents';
