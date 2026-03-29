-- Remove PIN-based authentication. All employees now log in with email + password.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin;
