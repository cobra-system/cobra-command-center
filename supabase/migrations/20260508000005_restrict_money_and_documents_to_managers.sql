-- Restrict financial data and documents to MANAGER role only.
--
-- Division managers (role != 'MANAGER') must not see, know about, or
-- access any documents, supplier payments, or order payments. The UI
-- already gates these surfaces; this migration enforces it server-side
-- so the data cannot be leaked via direct PostgREST/Supabase calls
-- (DevTools, scripts, etc.).
--
-- Tables affected:
--   - purchase_documents
--   - supplier_payments
--   - order_payments
--
-- The is_manager() function (already defined) returns true iff the
-- current auth.uid() has role = 'MANAGER' in profiles.
--
-- Column-level masking of products.purchase_price / sale_price is
-- intentionally NOT included here; that requires a view-based approach
-- and should be a separate migration.

-- ============================================================
-- purchase_documents
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read documents" ON public.purchase_documents;

CREATE POLICY "Managers can read documents"
  ON public.purchase_documents
  FOR SELECT
  TO authenticated
  USING (is_manager());

-- INSERT/UPDATE/DELETE policies were already manager-gated; no changes.

-- ============================================================
-- supplier_payments
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.supplier_payments;

CREATE POLICY "Managers can read payments"
  ON public.supplier_payments
  FOR SELECT
  TO authenticated
  USING (is_manager());

-- INSERT/UPDATE/DELETE policies were already manager-gated; no changes.

-- ============================================================
-- order_payments
-- ============================================================
-- All four CRUD policies were wide open (qual=true). Tighten all to is_manager().
DROP POLICY IF EXISTS order_payments_select ON public.order_payments;
DROP POLICY IF EXISTS order_payments_insert ON public.order_payments;
DROP POLICY IF EXISTS order_payments_update ON public.order_payments;
DROP POLICY IF EXISTS order_payments_delete ON public.order_payments;

CREATE POLICY order_payments_select
  ON public.order_payments
  FOR SELECT
  TO authenticated
  USING (is_manager());

CREATE POLICY order_payments_insert
  ON public.order_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_manager());

CREATE POLICY order_payments_update
  ON public.order_payments
  FOR UPDATE
  TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

CREATE POLICY order_payments_delete
  ON public.order_payments
  FOR DELETE
  TO authenticated
  USING (is_manager());
