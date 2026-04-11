-- Add entity_type and center_id to installers
-- entity_type: 'technician' (individual tech) | 'bonded' (external bonded entity)
-- center_id: links bonded entities to their distribution_center record

ALTER TABLE installers
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'technician'
    CHECK (entity_type IN ('technician', 'bonded')),
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES distribution_centers(id) ON DELETE SET NULL;

-- Seed the 3 bonded warehouses as installers of type 'bonded'
-- Using subqueries so we don't depend on hardcoded UUIDs
INSERT INTO installers (name, division, entity_type, center_id, status, coordinator)
SELECT
  dc.name,
  dc.name,   -- division = entity name (e.g. 'דלק מוטורס')
  'bonded',
  dc.id,
  'פעיל',
  NULL
FROM distribution_centers dc
WHERE dc.type = 'bonded'
  AND dc.name IN ('דלק מוטורס', 'פריזבי קרסו', 'לובינסקי')
  AND NOT EXISTS (
    SELECT 1 FROM installers i WHERE i.center_id = dc.id
  );
