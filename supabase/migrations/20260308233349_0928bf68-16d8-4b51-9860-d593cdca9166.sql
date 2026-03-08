
-- Fix function search paths to include extensions schema for pgcrypto
CREATE OR REPLACE FUNCTION public.hash_pin(raw_pin TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT crypt(raw_pin, gen_salt('bf'))
$$;

CREATE OR REPLACE FUNCTION public.verify_pin(raw_pin TEXT, hashed_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT hashed_pin = crypt(raw_pin, hashed_pin)
$$;

-- Also fix login_by_pin to include extensions
CREATE OR REPLACE FUNCTION public.login_by_pin(input_pin TEXT)
RETURNS TABLE(id UUID, name TEXT, role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.role
  FROM public.profiles p
  WHERE public.verify_pin(input_pin, p.pin)
  LIMIT 1;
END;
$$;
