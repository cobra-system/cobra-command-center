-- Soft-delete: add deleted_at to core tables, convert DELETEs to soft-deletes via trigger,
-- update RLS SELECT policies, and schedule 30-day cleanup via pg_cron.

-- ─────────────────────────────────────────────
-- 1. Add deleted_at column to core tables
-- ─────────────────────────────────────────────
ALTER TABLE orders              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE products            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE suppliers           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE tasks               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE purchase_documents  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE compliance_items    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE meetings            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE goals               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE waste_items         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE installers          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE equipment_pickups   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE equipment_returns   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE product_issues      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE supplier_payments   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE order_payments      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE shipment_groups     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE distribution_centers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE order_requests      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE warehouse_zones     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ─────────────────────────────────────────────
-- 2. Partial indexes for fast trash queries
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_deleted             ON orders(deleted_at)              WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted           ON products(deleted_at)            WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted          ON suppliers(deleted_at)           WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted              ON tasks(deleted_at)               WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_docs_deleted      ON purchase_documents(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_deleted         ON compliance_items(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_deleted           ON meetings(deleted_at)            WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_deleted              ON goals(deleted_at)               WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waste_items_deleted        ON waste_items(deleted_at)         WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_installers_deleted         ON installers(deleted_at)          WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eq_pickups_deleted         ON equipment_pickups(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eq_returns_deleted         ON equipment_returns(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_issues_deleted     ON product_issues(deleted_at)      WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_pay_deleted       ON supplier_payments(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_pay_deleted          ON order_payments(deleted_at)      WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_groups_deleted    ON shipment_groups(deleted_at)     WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dist_centers_deleted       ON distribution_centers(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_requests_deleted     ON order_requests(deleted_at)      WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_deleted    ON warehouse_zones(deleted_at)     WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. Soft-delete trigger function
--    Intercepts DELETE and sets deleted_at instead.
--    WHEN (OLD.deleted_at IS NULL) ensures the pg_cron
--    hard-delete of expired rows is not intercepted.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION soft_delete_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_NAME)
  USING OLD.id;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. Attach trigger to each table
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS soft_delete_orders              ON orders;
DROP TRIGGER IF EXISTS soft_delete_products            ON products;
DROP TRIGGER IF EXISTS soft_delete_suppliers           ON suppliers;
DROP TRIGGER IF EXISTS soft_delete_tasks               ON tasks;
DROP TRIGGER IF EXISTS soft_delete_purchase_documents  ON purchase_documents;
DROP TRIGGER IF EXISTS soft_delete_compliance_items    ON compliance_items;
DROP TRIGGER IF EXISTS soft_delete_meetings            ON meetings;
DROP TRIGGER IF EXISTS soft_delete_goals               ON goals;
DROP TRIGGER IF EXISTS soft_delete_waste_items         ON waste_items;
DROP TRIGGER IF EXISTS soft_delete_installers          ON installers;
DROP TRIGGER IF EXISTS soft_delete_equipment_pickups   ON equipment_pickups;
DROP TRIGGER IF EXISTS soft_delete_equipment_returns   ON equipment_returns;
DROP TRIGGER IF EXISTS soft_delete_product_issues      ON product_issues;
DROP TRIGGER IF EXISTS soft_delete_supplier_payments   ON supplier_payments;
DROP TRIGGER IF EXISTS soft_delete_order_payments      ON order_payments;
DROP TRIGGER IF EXISTS soft_delete_shipment_groups     ON shipment_groups;
DROP TRIGGER IF EXISTS soft_delete_distribution_centers ON distribution_centers;
DROP TRIGGER IF EXISTS soft_delete_order_requests      ON order_requests;
DROP TRIGGER IF EXISTS soft_delete_warehouse_zones     ON warehouse_zones;

CREATE TRIGGER soft_delete_orders
  BEFORE DELETE ON orders              FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_products
  BEFORE DELETE ON products            FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_suppliers
  BEFORE DELETE ON suppliers           FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_tasks
  BEFORE DELETE ON tasks               FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_purchase_documents
  BEFORE DELETE ON purchase_documents  FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_compliance_items
  BEFORE DELETE ON compliance_items    FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_meetings
  BEFORE DELETE ON meetings            FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_goals
  BEFORE DELETE ON goals               FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_waste_items
  BEFORE DELETE ON waste_items         FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_installers
  BEFORE DELETE ON installers          FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_equipment_pickups
  BEFORE DELETE ON equipment_pickups   FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_equipment_returns
  BEFORE DELETE ON equipment_returns   FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_product_issues
  BEFORE DELETE ON product_issues      FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_supplier_payments
  BEFORE DELETE ON supplier_payments   FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_order_payments
  BEFORE DELETE ON order_payments      FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_shipment_groups
  BEFORE DELETE ON shipment_groups     FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_distribution_centers
  BEFORE DELETE ON distribution_centers FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_order_requests
  BEFORE DELETE ON order_requests      FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();
CREATE TRIGGER soft_delete_warehouse_zones
  BEFORE DELETE ON warehouse_zones     FOR EACH ROW WHEN (OLD.deleted_at IS NULL) EXECUTE FUNCTION soft_delete_handler();

-- ─────────────────────────────────────────────
-- 5. Update SELECT RLS policies to hide soft-deleted rows
-- ─────────────────────────────────────────────

-- orders
DROP POLICY IF EXISTS "non_managers_orders_select" ON orders;
CREATE POLICY "non_managers_orders_select" ON orders
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      is_manager()
      OR division ILIKE '%' || (SELECT division FROM profiles WHERE id = auth.uid()) || '%'
    )
  );

-- products
DROP POLICY IF EXISTS "non_managers_products_select" ON products;
CREATE POLICY "non_managers_products_select" ON products
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      is_manager()
      OR (division IS NULL)
      OR (division = '')
      OR ((SELECT division FROM profiles WHERE id = auth.uid()) IS NULL)
      OR (division ILIKE '%' || (SELECT division FROM profiles WHERE id = auth.uid()) || '%')
    )
  );

-- suppliers
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON suppliers;
CREATE POLICY "Authenticated users can read suppliers" ON suppliers
  FOR SELECT USING (deleted_at IS NULL);

-- tasks
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks;
CREATE POLICY "Authenticated users can read tasks" ON tasks
  FOR SELECT USING (deleted_at IS NULL);

-- compliance_items
DROP POLICY IF EXISTS "Authenticated users can read compliance items" ON compliance_items;
CREATE POLICY "Authenticated users can read compliance items" ON compliance_items
  FOR SELECT USING (deleted_at IS NULL);

-- goals
DROP POLICY IF EXISTS "Authenticated users can read goals" ON goals;
CREATE POLICY "Authenticated users can read goals" ON goals
  FOR SELECT USING (deleted_at IS NULL);

-- meetings
DROP POLICY IF EXISTS "Authenticated users can read meetings" ON meetings;
CREATE POLICY "Authenticated users can read meetings" ON meetings
  FOR SELECT USING (deleted_at IS NULL);

-- purchase_documents
DROP POLICY IF EXISTS "Managers can read documents" ON purchase_documents;
CREATE POLICY "Managers can read documents" ON purchase_documents
  FOR SELECT USING (is_manager() AND deleted_at IS NULL);

-- waste_items
DROP POLICY IF EXISTS "Authenticated users can read waste_items" ON waste_items;
CREATE POLICY "Authenticated users can read waste_items" ON waste_items
  FOR SELECT USING (deleted_at IS NULL);

-- product_issues
DROP POLICY IF EXISTS "Authenticated users can read issues" ON product_issues;
CREATE POLICY "Authenticated users can read issues" ON product_issues
  FOR SELECT USING (deleted_at IS NULL);

-- distribution_centers
DROP POLICY IF EXISTS "Authenticated users can read centers" ON distribution_centers;
CREATE POLICY "Authenticated users can read centers" ON distribution_centers
  FOR SELECT USING (deleted_at IS NULL);

-- supplier_payments
DROP POLICY IF EXISTS "Managers can read payments" ON supplier_payments;
CREATE POLICY "Managers can read payments" ON supplier_payments
  FOR SELECT USING (is_manager() AND deleted_at IS NULL);

-- order_payments
DROP POLICY IF EXISTS "order_payments_select" ON order_payments;
CREATE POLICY "order_payments_select" ON order_payments
  FOR SELECT USING (is_manager() AND deleted_at IS NULL);

-- shipment_groups
DROP POLICY IF EXISTS "shipment_groups_select" ON shipment_groups;
CREATE POLICY "shipment_groups_select" ON shipment_groups
  FOR SELECT USING (deleted_at IS NULL);

-- warehouse_zones
DROP POLICY IF EXISTS "wz_select" ON warehouse_zones;
CREATE POLICY "wz_select" ON warehouse_zones
  FOR SELECT USING (deleted_at IS NULL);

-- order_requests
DROP POLICY IF EXISTS "order_requests_select" ON order_requests;
CREATE POLICY "order_requests_select" ON order_requests
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER'::app_role)
      OR division = (SELECT division FROM profiles WHERE id = auth.uid())
    )
  );

-- installers: replace FOR ALL policy with filtered one
DROP POLICY IF EXISTS "Allow all for authenticated users" ON installers;
CREATE POLICY "Allow all for authenticated users" ON installers
  FOR ALL USING (deleted_at IS NULL);

-- equipment_pickups
DROP POLICY IF EXISTS "Allow all for authenticated users" ON equipment_pickups;
CREATE POLICY "Allow all for authenticated users" ON equipment_pickups
  FOR ALL USING (deleted_at IS NULL);

-- equipment_returns
DROP POLICY IF EXISTS "Allow all for authenticated users" ON equipment_returns;
CREATE POLICY "Allow all for authenticated users" ON equipment_returns
  FOR ALL USING (deleted_at IS NULL);

-- ─────────────────────────────────────────────
-- 6. RPC: get_deleted_items() — manager only, bypasses RLS
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_deleted_items()
RETURNS TABLE(
  table_name  TEXT,
  item_id     UUID,
  label       TEXT,
  sub_label   TEXT,
  deleted_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT 'orders'::TEXT, id,
      COALESCE(supplier_name, pi_number, id::TEXT),
      COALESCE(pi_number, order_date::TEXT, ''),
      o.deleted_at, o.deleted_at + INTERVAL '30 days'
    FROM orders o WHERE o.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'products', id,
      COALESCE(name, sku, id::TEXT),
      COALESCE(sku, ''),
      p.deleted_at, p.deleted_at + INTERVAL '30 days'
    FROM products p WHERE p.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'suppliers', id,
      COALESCE(company, contact_name, id::TEXT),
      COALESCE(country, ''),
      s.deleted_at, s.deleted_at + INTERVAL '30 days'
    FROM suppliers s WHERE s.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'tasks', id,
      COALESCE(title, id::TEXT),
      COALESCE(priority, ''),
      t.deleted_at, t.deleted_at + INTERVAL '30 days'
    FROM tasks t WHERE t.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'purchase_documents', id,
      COALESCE(document_name, document_number, id::TEXT),
      COALESCE(type, ''),
      pd.deleted_at, pd.deleted_at + INTERVAL '30 days'
    FROM purchase_documents pd WHERE pd.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'compliance_items', id,
      COALESCE(name, id::TEXT),
      COALESCE(category, ''),
      ci.deleted_at, ci.deleted_at + INTERVAL '30 days'
    FROM compliance_items ci WHERE ci.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'meetings', id,
      COALESCE(title, id::TEXT),
      COALESCE(type, ''),
      m.deleted_at, m.deleted_at + INTERVAL '30 days'
    FROM meetings m WHERE m.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'goals', id,
      COALESCE(name, id::TEXT),
      '',
      g.deleted_at, g.deleted_at + INTERVAL '30 days'
    FROM goals g WHERE g.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'waste_items', id,
      COALESCE(product_name, id::TEXT),
      COALESCE(sku, ''),
      wi.deleted_at, wi.deleted_at + INTERVAL '30 days'
    FROM waste_items wi WHERE wi.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'installers', id,
      COALESCE(name, id::TEXT),
      COALESCE(division, ''),
      ins.deleted_at, ins.deleted_at + INTERVAL '30 days'
    FROM installers ins WHERE ins.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'equipment_pickups', id,
      'איסוף ציוד'::TEXT,
      COALESCE(pickup_date::TEXT, ''),
      ep.deleted_at, ep.deleted_at + INTERVAL '30 days'
    FROM equipment_pickups ep WHERE ep.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'equipment_returns', id,
      'החזרת ציוד'::TEXT,
      COALESCE(return_date::TEXT, ''),
      er.deleted_at, er.deleted_at + INTERVAL '30 days'
    FROM equipment_returns er WHERE er.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'product_issues', id,
      COALESCE(LEFT(description, 80), id::TEXT),
      COALESCE(ticket_number, ''),
      pi2.deleted_at, pi2.deleted_at + INTERVAL '30 days'
    FROM product_issues pi2 WHERE pi2.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'supplier_payments', id,
      COALESCE(amount::TEXT || ' ' || currency, id::TEXT),
      COALESCE(status, ''),
      sp.deleted_at, sp.deleted_at + INTERVAL '30 days'
    FROM supplier_payments sp WHERE sp.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'order_payments', id,
      COALESCE(payment_type || ' – ' || amount::TEXT || ' ' || currency, id::TEXT),
      COALESCE(status, ''),
      op.deleted_at, op.deleted_at + INTERVAL '30 days'
    FROM order_payments op WHERE op.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'shipment_groups', id,
      COALESCE(name, vessel_name, id::TEXT),
      '',
      sg.deleted_at, sg.deleted_at + INTERVAL '30 days'
    FROM shipment_groups sg WHERE sg.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'distribution_centers', id,
      COALESCE(name, id::TEXT),
      COALESCE(city, ''),
      dc.deleted_at, dc.deleted_at + INTERVAL '30 days'
    FROM distribution_centers dc WHERE dc.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'order_requests', id,
      COALESCE(product_name, id::TEXT),
      COALESCE(division, ''),
      orq.deleted_at, orq.deleted_at + INTERVAL '30 days'
    FROM order_requests orq WHERE orq.deleted_at IS NOT NULL
  UNION ALL
    SELECT 'warehouse_zones', id,
      COALESCE(name, id::TEXT),
      '',
      wz.deleted_at, wz.deleted_at + INTERVAL '30 days'
    FROM warehouse_zones wz WHERE wz.deleted_at IS NOT NULL
  ORDER BY 5 DESC;
END;
$$;

-- ─────────────────────────────────────────────
-- 7. RPC: restore_item(table, id) — manager only
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restore_item(p_table TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_table NOT IN (
    'orders','products','suppliers','tasks','purchase_documents',
    'compliance_items','meetings','goals','waste_items','installers',
    'equipment_pickups','equipment_returns','product_issues','supplier_payments',
    'order_payments','shipment_groups','distribution_centers','order_requests','warehouse_zones'
  ) THEN
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;

  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', p_table) USING p_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 8. RPC: hard_delete_item(table, id) — manager only, permanent delete
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION hard_delete_item(p_table TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_table NOT IN (
    'orders','products','suppliers','tasks','purchase_documents',
    'compliance_items','meetings','goals','waste_items','installers',
    'equipment_pickups','equipment_returns','product_issues','supplier_payments',
    'order_payments','shipment_groups','distribution_centers','order_requests','warehouse_zones'
  ) THEN
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;

  -- deleted_at IS NOT NULL guard ensures only already-soft-deleted rows can be hard-deleted
  EXECUTE format('DELETE FROM %I WHERE id = $1 AND deleted_at IS NOT NULL', p_table) USING p_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 9. Cleanup function + pg_cron schedule (daily at 03:00 UTC)
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION cleanup_expired_soft_deletes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
  DELETE FROM orders              WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM products            WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM suppliers           WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM tasks               WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM purchase_documents  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM compliance_items    WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM meetings            WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM goals               WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM waste_items         WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM installers          WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM equipment_pickups   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM equipment_returns   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM product_issues      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM supplier_payments   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM order_payments      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM shipment_groups     WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM distribution_centers WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM order_requests      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM warehouse_zones     WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
END;
$$;

-- Remove old schedule if exists, then create fresh
SELECT cron.unschedule('cleanup-soft-deletes') FROM cron.job WHERE jobname = 'cleanup-soft-deletes';
SELECT cron.schedule('cleanup-soft-deletes', '0 3 * * *', 'SELECT cleanup_expired_soft_deletes()');
