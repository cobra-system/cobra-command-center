-- Link distribution centers to divisions so bonded centers are associated with their division
ALTER TABLE distribution_centers ADD COLUMN IF NOT EXISTS division text NULL;

UPDATE distribution_centers SET division = name
WHERE name IN ('דלק מוטורס', 'פריזבי קרסו', 'לובינסקי');
