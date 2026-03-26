-- Fix custom role support:
-- 1. Change role_permissions.role from app_role enum to text so custom role IDs can be stored
-- 2. Add role_definition_id to profiles so workers can be linked to custom (non-enum) roles

-- Change role_permissions.role from app_role enum to text (existing rows kept as-is via ::text cast)
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE text USING role::text;

-- Add role_definition_id to profiles, referencing role_definitions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_definition_id uuid REFERENCES public.role_definitions(id) ON DELETE SET NULL;

-- Populate role_definition_id for existing profiles based on system_key matching their current role
UPDATE public.profiles p
SET role_definition_id = (
  SELECT id FROM public.role_definitions rd WHERE rd.system_key = p.role::text LIMIT 1
);
