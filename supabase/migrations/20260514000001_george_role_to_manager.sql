-- Change George's (גיאורגי גריגוריאנץ) role from WAREHOUSE_MANAGER to MANAGER
UPDATE profiles
SET role = 'MANAGER'
WHERE id = '50138e6e-506b-4b3e-9f15-5acac6804159';

UPDATE user_roles
SET role = 'MANAGER'
WHERE user_id = '50138e6e-506b-4b3e-9f15-5acac6804159';
