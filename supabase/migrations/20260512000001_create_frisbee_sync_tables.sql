-- Frisbee Base44 sync tables
-- Stores QA inspection data synced from the Base44 system operated by the פריזבי קרסו division

CREATE TABLE frisbee_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base44_id TEXT UNIQUE NOT NULL,
  base44_branch_id TEXT,
  inspection_date TIMESTAMPTZ,
  vehicle_number TEXT,
  chassis_color TEXT,
  manufacturer TEXT,
  model TEXT,
  owner_name TEXT,
  installer_names TEXT[],
  inspector_name TEXT,
  status TEXT,
  fault_count INT NOT NULL DEFAULT 0,
  faults JSONB,
  preliminary_faults TEXT,
  requires_detailing BOOLEAN NOT NULL DEFAULT false,
  protection_code TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  base44_created_date TIMESTAMPTZ
);

CREATE INDEX idx_frisbee_inspections_date ON frisbee_inspections(inspection_date);
CREATE INDEX idx_frisbee_inspections_branch ON frisbee_inspections(base44_branch_id);
CREATE INDEX idx_frisbee_inspections_status ON frisbee_inspections(status);

-- Normalized equipment checklist items per inspection
CREATE TABLE frisbee_inspection_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base44_inspection_id TEXT NOT NULL REFERENCES frisbee_inspections(base44_id) ON DELETE CASCADE,
  base44_equipment_id TEXT NOT NULL,
  equipment_name TEXT,
  checked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_fie_inspection ON frisbee_inspection_equipment(base44_inspection_id);
CREATE INDEX idx_fie_equipment ON frisbee_inspection_equipment(base44_equipment_id);
CREATE INDEX idx_fie_checked ON frisbee_inspection_equipment(checked) WHERE checked = true;

-- Maps Base44 equipment IDs to our internal products
CREATE TABLE frisbee_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base44_equipment_id TEXT UNIQUE NOT NULL,
  base44_equipment_name TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE frisbee_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE frisbee_inspection_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE frisbee_product_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read frisbee_inspections"
  ON frisbee_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read frisbee_inspection_equipment"
  ON frisbee_inspection_equipment FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read frisbee_product_mapping"
  ON frisbee_product_mapping FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated write frisbee_product_mapping"
  ON frisbee_product_mapping FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Aggregated consumption view — avoids loading 60k+ raw rows in the browser
CREATE VIEW frisbee_equipment_consumption AS
SELECT
  fie.base44_equipment_id,
  MIN(fie.equipment_name)                              AS equipment_name,
  fi.base44_branch_id,
  COUNT(*) FILTER (WHERE fie.checked = true)           AS installed_count,
  COUNT(DISTINCT fi.base44_id)                         AS total_inspections,
  MAX(fi.synced_at)                                    AS last_synced_at,
  COUNT(*) FILTER (WHERE fi.fault_count > 0 AND fie.checked = true)  AS inspections_with_faults
FROM frisbee_inspection_equipment fie
JOIN frisbee_inspections fi ON fi.base44_id = fie.base44_inspection_id
WHERE fi.status = 'completed'
GROUP BY fie.base44_equipment_id, fi.base44_branch_id;
