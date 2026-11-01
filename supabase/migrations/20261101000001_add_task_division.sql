-- Tasks can optionally be tied to a division (חטיבה), e.g. "order something for
-- Fuel Motors" or "check with AWACS". Free text, matching how every other table
-- stores the division name. NULL = general task, not tied to any division.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS division text;

CREATE INDEX IF NOT EXISTS tasks_division_idx ON public.tasks (division) WHERE division IS NOT NULL;
