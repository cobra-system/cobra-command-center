-- Monthly equipment consumption aggregated by branch + date range
-- Used by the FrisbeeDashboard (Tab 1 – צריכת אביזרים, Tab 3 – חיפוש פריטים)
CREATE OR REPLACE FUNCTION get_frisbee_monthly_stats(
  p_branch_id TEXT,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  equipment_name TEXT,
  month TEXT,
  installed_count BIGINT,
  inspection_count BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    fie.equipment_name,
    TO_CHAR(DATE_TRUNC('month', fi.inspection_date), 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE fie.checked = true)                  AS installed_count,
    COUNT(DISTINCT fi.base44_id)                                AS inspection_count
  FROM frisbee_inspection_equipment fie
  JOIN frisbee_inspections fi ON fie.base44_inspection_id = fi.base44_id
  WHERE fi.base44_branch_id = p_branch_id
    AND fi.inspection_date >= p_start_date
    AND fi.inspection_date <= p_end_date
  GROUP BY fie.equipment_name, DATE_TRUNC('month', fi.inspection_date)
  ORDER BY DATE_TRUNC('month', fi.inspection_date), fie.equipment_name;
$$;

-- Vehicle model stats for Tab 2 – דשבורד מכירות
CREATE OR REPLACE FUNCTION get_frisbee_model_stats(
  p_branch_id TEXT,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  manufacturer      TEXT,
  model             TEXT,
  inspection_count  BIGINT,
  total_accessories BIGINT,
  avg_per_vehicle   FLOAT,
  top_accessories   JSONB
) LANGUAGE SQL STABLE AS $$
  SELECT
    fi.manufacturer,
    fi.model,
    COUNT(DISTINCT fi.base44_id)                                        AS inspection_count,
    COUNT(*) FILTER (WHERE fie.checked = true)                          AS total_accessories,
    COUNT(*) FILTER (WHERE fie.checked = true)::float
      / NULLIF(COUNT(DISTINCT fi.base44_id), 0)                         AS avg_per_vehicle,
    (
      SELECT jsonb_agg(row_to_json(sub))
      FROM (
        SELECT fie2.equipment_name AS name, COUNT(*) AS count
        FROM frisbee_inspection_equipment fie2
        JOIN frisbee_inspections fi2 ON fie2.base44_inspection_id = fi2.base44_id
        WHERE fi2.base44_branch_id = p_branch_id
          AND fi2.manufacturer     = fi.manufacturer
          AND fi2.model            = fi.model
          AND fie2.checked         = true
          AND fi2.inspection_date >= p_start_date
          AND fi2.inspection_date <= p_end_date
        GROUP BY fie2.equipment_name
        ORDER BY COUNT(*) DESC
        LIMIT 3
      ) sub
    ) AS top_accessories
  FROM frisbee_inspections fi
  JOIN frisbee_inspection_equipment fie ON fie.base44_inspection_id = fi.base44_id
  WHERE fi.base44_branch_id = p_branch_id
    AND fi.inspection_date >= p_start_date
    AND fi.inspection_date <= p_end_date
  GROUP BY fi.manufacturer, fi.model
  ORDER BY inspection_count DESC;
$$;
