-- Quarterly procurement planning tables
-- Digitizes the Excel-based quarterly procurement workflow for bonded divisions:
-- vehicle model forecasts → product-model mappings → procurement calculations

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table A: vehicle_models — Master list of vehicle models per division
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  brand TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_family TEXT,
  segment TEXT,
  model_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(division, model_name, segment)
);

CREATE INDEX idx_vehicle_models_division ON vehicle_models(division);
CREATE INDEX idx_vehicle_models_family ON vehicle_models(model_family);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table B: quarterly_vehicle_forecasts — Monthly quantities per model per quarter
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE quarterly_vehicle_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_id UUID NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  month1_qty INT NOT NULL DEFAULT 0,
  month2_qty INT NOT NULL DEFAULT 0,
  month3_qty INT NOT NULL DEFAULT 0,
  total_qty INT GENERATED ALWAYS AS (month1_qty + month2_qty + month3_qty) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(vehicle_model_id, year, quarter)
);

CREATE INDEX idx_qvf_model ON quarterly_vehicle_forecasts(vehicle_model_id);
CREATE INDEX idx_qvf_period ON quarterly_vehicle_forecasts(year, quarter);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table C: product_model_mappings — Which products go on which model families
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE product_model_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  model_family TEXT NOT NULL,
  utilization_pct NUMERIC NOT NULL DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(division, product_id, model_family)
);

CREATE INDEX idx_pmm_division ON product_model_mappings(division);
CREATE INDEX idx_pmm_product ON product_model_mappings(product_id);
CREATE INDEX idx_pmm_family ON product_model_mappings(model_family);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table D: quarterly_procurement_plans — Computed/tracked procurement per product
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE quarterly_procurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),

  computed_forecast INT,
  manual_forecast_override INT,
  utilization_pct NUMERIC DEFAULT 1.0,
  safety_buffer NUMERIC DEFAULT 1.2,
  smoothed_required NUMERIC,
  current_stock INT,
  incoming_orders INT DEFAULT 0,
  required_to_order NUMERIC,

  month1_demand NUMERIC,
  month2_demand NUMERIC,
  month3_demand NUMERIC,

  order_execution_date TEXT,
  payment_status TEXT,
  actual_ordered_qty INT,
  shipping_type TEXT,
  estimated_arrival_date TEXT,
  incoming_arrival_date TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(division, product_id, year, quarter)
);

CREATE INDEX idx_qpp_division ON quarterly_procurement_plans(division);
CREATE INDEX idx_qpp_period ON quarterly_procurement_plans(year, quarter);
CREATE INDEX idx_qpp_product ON quarterly_procurement_plans(product_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_vehicle_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_model_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_procurement_plans ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "authenticated read vehicle_models"
  ON vehicle_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read quarterly_vehicle_forecasts"
  ON quarterly_vehicle_forecasts FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read product_model_mappings"
  ON product_model_mappings FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read quarterly_procurement_plans"
  ON quarterly_procurement_plans FOR SELECT TO authenticated USING (true);

-- Write access: managers can write all; division managers can write their own division
CREATE POLICY "managers write vehicle_models"
  ON vehicle_models FOR ALL TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'MANAGER'
        OR (profiles.division IS NOT NULL AND profiles.division = vehicle_models.division)
      )
    )
  );

CREATE POLICY "managers write quarterly_vehicle_forecasts"
  ON quarterly_vehicle_forecasts FOR ALL TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_models vm
      JOIN profiles p ON p.id = auth.uid()
      WHERE vm.id = quarterly_vehicle_forecasts.vehicle_model_id
      AND (p.role = 'MANAGER' OR (p.division IS NOT NULL AND p.division = vm.division))
    )
  );

CREATE POLICY "managers write product_model_mappings"
  ON product_model_mappings FOR ALL TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'MANAGER'
        OR (profiles.division IS NOT NULL AND profiles.division = product_model_mappings.division)
      )
    )
  );

CREATE POLICY "managers write quarterly_procurement_plans"
  ON quarterly_procurement_plans FOR ALL TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'MANAGER'
        OR (profiles.division IS NOT NULL AND profiles.division = quarterly_procurement_plans.division)
      )
    )
  );
