-- Item ledger (כרטסת פריט) — monthly import of the ERP item-movement export.
--
-- The ERP exports one block per item: a header row (SKU, name, opening balance),
-- every movement line (date, document, warehouse, counterparty, qty, running
-- balance) and a closing row. Each monthly upload replaces, per SKU, the
-- movements inside the file's date range, so re-uploading a cumulative export
-- (Jan–Oct after Jan–Sep) or a single month both leave one clean history.
--
--   item_ledger_imports    one row per uploaded file
--   item_ledger_items      one row per SKU: covered period + opening/closing balance
--   item_ledger_movements  every movement line, keyed by SKU

CREATE TABLE IF NOT EXISTS public.item_ledger_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name       text NOT NULL,
  period_start    date,
  period_end      date,
  item_count      integer NOT NULL DEFAULT 0,
  movement_count  integer NOT NULL DEFAULT 0,
  unmatched_skus  text[] NOT NULL DEFAULT '{}',
  imported_by     uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.item_ledger_items (
  sku              text PRIMARY KEY,
  product_id       uuid REFERENCES public.products(id) ON DELETE SET NULL,
  item_name        text,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  opening_balance  numeric NOT NULL DEFAULT 0,
  closing_balance  numeric NOT NULL DEFAULT 0,
  last_import_id   uuid REFERENCES public.item_ledger_imports(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_ledger_items_product ON public.item_ledger_items(product_id);

CREATE TABLE IF NOT EXISTS public.item_ledger_movements (
  id              bigserial PRIMARY KEY,
  sku             text NOT NULL REFERENCES public.item_ledger_items(sku) ON DELETE CASCADE ON UPDATE CASCADE,
  import_id       uuid REFERENCES public.item_ledger_imports(id) ON DELETE SET NULL,
  movement_date   date NOT NULL,
  line_no         integer NOT NULL,
  doc_type        text NOT NULL,
  doc_number      text,
  doc_line        integer,
  warehouse_code  text,
  account_code    text,
  account_name    text,
  quantity        numeric NOT NULL,
  unit_price      numeric,
  balance         numeric
);

CREATE INDEX IF NOT EXISTS idx_item_ledger_movements_sku_date
  ON public.item_ledger_movements(sku, movement_date, line_no);


-- ---------------------------------------------------------------------------
-- import_item_ledger(import_id, items) — atomic per call.
-- items: [{ sku, item_name, product_id, period_start, period_end,
--           opening_balance, closing_balance, movements: [...] }]
-- For each item: drop its movements inside [period_start, period_end], insert
-- the new ones, and widen the item's covered period. The opening balance is
-- taken from the file only when the file starts at or before what we already
-- hold; the closing balance only when it ends at or after.
-- SECURITY INVOKER so the table RLS policies below apply to the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_item_ledger(p_import_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_sku     text;
  v_start   date;
  v_end     date;
  v_count   integer := 0;
  v_rows    integer;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sku   := upper(trim(v_item->>'sku'));
    v_start := (v_item->>'period_start')::date;
    v_end   := (v_item->>'period_end')::date;

    INSERT INTO item_ledger_items AS i
      (sku, product_id, item_name, period_start, period_end, opening_balance, closing_balance, last_import_id, updated_at)
    VALUES
      (v_sku, NULLIF(v_item->>'product_id', '')::uuid, v_item->>'item_name', v_start, v_end,
       COALESCE((v_item->>'opening_balance')::numeric, 0), COALESCE((v_item->>'closing_balance')::numeric, 0),
       p_import_id, now())
    ON CONFLICT (sku) DO UPDATE SET
      product_id      = COALESCE(EXCLUDED.product_id, i.product_id),
      item_name       = COALESCE(EXCLUDED.item_name, i.item_name),
      opening_balance = CASE WHEN EXCLUDED.period_start <= i.period_start THEN EXCLUDED.opening_balance ELSE i.opening_balance END,
      closing_balance = CASE WHEN EXCLUDED.period_end   >= i.period_end   THEN EXCLUDED.closing_balance ELSE i.closing_balance END,
      period_start    = LEAST(i.period_start, EXCLUDED.period_start),
      period_end      = GREATEST(i.period_end, EXCLUDED.period_end),
      last_import_id  = EXCLUDED.last_import_id,
      updated_at      = now();

    DELETE FROM item_ledger_movements
    WHERE sku = v_sku AND movement_date BETWEEN v_start AND v_end;

    INSERT INTO item_ledger_movements
      (sku, import_id, movement_date, line_no, doc_type, doc_number, doc_line,
       warehouse_code, account_code, account_name, quantity, unit_price, balance)
    SELECT v_sku, p_import_id, m.movement_date, m.line_no, m.doc_type, m.doc_number, m.doc_line,
           m.warehouse_code, m.account_code, m.account_name, m.quantity, m.unit_price, m.balance
    FROM jsonb_to_recordset(COALESCE(v_item->'movements', '[]'::jsonb)) AS m(
      movement_date date, line_no integer, doc_type text, doc_number text, doc_line integer,
      warehouse_code text, account_code text, account_name text,
      quantity numeric, unit_price numeric, balance numeric
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_item_ledger(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_item_ledger(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_item_ledger(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_item_ledger(uuid, jsonb) TO service_role;


-- ---------------------------------------------------------------------------
-- RLS: internal collaborative tool — any authenticated user may read and write,
-- matching the other procurement tables.
-- ---------------------------------------------------------------------------
ALTER TABLE public.item_ledger_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_ledger_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_ledger_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read item ledger imports" ON public.item_ledger_imports;
CREATE POLICY "Authenticated users can read item ledger imports" ON public.item_ledger_imports
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert item ledger imports" ON public.item_ledger_imports;
CREATE POLICY "Authenticated users can insert item ledger imports" ON public.item_ledger_imports
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update item ledger imports" ON public.item_ledger_imports;
CREATE POLICY "Authenticated users can update item ledger imports" ON public.item_ledger_imports
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete item ledger imports" ON public.item_ledger_imports;
CREATE POLICY "Authenticated users can delete item ledger imports" ON public.item_ledger_imports
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read item ledger items" ON public.item_ledger_items;
CREATE POLICY "Authenticated users can read item ledger items" ON public.item_ledger_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert item ledger items" ON public.item_ledger_items;
CREATE POLICY "Authenticated users can insert item ledger items" ON public.item_ledger_items
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update item ledger items" ON public.item_ledger_items;
CREATE POLICY "Authenticated users can update item ledger items" ON public.item_ledger_items
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete item ledger items" ON public.item_ledger_items;
CREATE POLICY "Authenticated users can delete item ledger items" ON public.item_ledger_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read item ledger movements" ON public.item_ledger_movements;
CREATE POLICY "Authenticated users can read item ledger movements" ON public.item_ledger_movements
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert item ledger movements" ON public.item_ledger_movements;
CREATE POLICY "Authenticated users can insert item ledger movements" ON public.item_ledger_movements
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update item ledger movements" ON public.item_ledger_movements;
CREATE POLICY "Authenticated users can update item ledger movements" ON public.item_ledger_movements
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete item ledger movements" ON public.item_ledger_movements;
CREATE POLICY "Authenticated users can delete item ledger movements" ON public.item_ledger_movements
  FOR DELETE TO authenticated USING (true);
