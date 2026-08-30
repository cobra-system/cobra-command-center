-- Import files (תיקי יבוא) — the customs-broker dossier that arrives by email a
-- few days after a sea/air shipment lands.
--
-- A dossier is what the forwarder calls a "תיק" (file number, e.g. 460509). It
-- bundles 5-8 PDFs that all describe the SAME physical shipment:
--   * Commercial Invoice        — what was bought (supplier, PI number, values)
--   * Packing List              — pallets, cartons, weight, volume
--   * Bill of Lading / HAWB     — B/L number, container, vessel, ports
--   * הצהרת יבוא (רשימון)        — the customs declaration: duty and VAT
--   * Freight invoice           — ocean freight and origin charges
--   * Terminal invoice          — port/terminal handling
--   * Forwarder summary invoice — everything above, consolidated
--
-- Three facts drove this schema:
--
-- 1. ONE DOSSIER CAN COVER SEVERAL ORDERS. A consolidated container regularly
--    carries goods from more than one purchase order, so the link to orders is
--    a join table (import_file_orders), never a single FK. Costs are therefore
--    allocated per order rather than simply copied onto one.
--
-- 2. FORWARDER INVOICES NEST. The summary invoice restates the freight and
--    terminal invoices as its own line items. Summing every document naively
--    double-counts them, so import_cost_lines.included_in_document_id marks a
--    line that is already represented inside another document, and the money
--    views exclude those lines.
--
-- 3. VAT IS RECOVERABLE. Import VAT is offset against output VAT and must not
--    inflate a product's landed cost. import_cost_lines.is_recoverable keeps it
--    out of cost calculations while still recording what was actually paid.
--
-- Formats differ per forwarder, so every extracted field is nullable: a dossier
-- is useful the moment it has a file number and one attached document.

CREATE TABLE IF NOT EXISTS public.import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The forwarder's file number ("תיק"), e.g. 460509. The one identifier that
  -- appears on every document in the dossier, so it is how a human finds it.
  file_number TEXT NOT NULL,

  -- Who handled the clearance (Total Care Logistics, and others in future).
  forwarder_name TEXT,

  -- Customs declaration (רשימון) — the tax authority's own reference.
  declaration_number TEXT,
  declaration_date DATE,

  -- Carrier / shipment identifiers, used later to auto-match a dossier to an
  -- order. Kept as free text because forwarders format them differently
  -- (a B/L may arrive as "RWOE2603160002" or as the bare house bill "03160002").
  bl_number TEXT,           -- master or house bill of lading / AWB
  house_bl_number TEXT,
  container_number TEXT,
  vessel_name TEXT,
  port_of_loading TEXT,
  port_of_discharge TEXT,

  shipment_mode TEXT NOT NULL DEFAULT 'SEA'
    CHECK (shipment_mode IN ('SEA', 'AIR', 'LAND', 'COURIER')),

  etd DATE,
  arrival_date DATE,        -- when the vessel/flight landed
  release_date DATE,        -- when customs released the goods (תאריך התרה)

  -- Supplier side. supplier_id is the matched Cobra supplier; supplier_name
  -- keeps whatever the document actually said, so a failed match is still
  -- traceable.
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  supplier_invoice_number TEXT,   -- the PI / commercial invoice number

  -- Money. Goods value is what the supplier billed; the ILS figures come from
  -- the customs declaration, which fixes its own exchange rate.
  goods_value NUMERIC,
  goods_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC,
  customs_value_ils NUMERIC,      -- ערך לצרכי מס

  -- Physical totals, straight off the packing list / bill of lading.
  gross_weight_kg NUMERIC,
  volume_cbm NUMERIC,
  package_count INTEGER,

  -- Optional grouping when the shipment is already tracked as a group.
  shipment_group_id UUID REFERENCES public.shipment_groups(id) ON DELETE SET NULL,

  -- draft    — created, still being filled in
  -- matched  — linked to at least one order
  -- complete — documents and costs all captured
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'matched', 'complete')),

  notes TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- A forwarder's file number is unique per forwarder, but two forwarders may
-- reuse the same digits. Scope uniqueness to live rows so a soft-deleted
-- dossier does not block re-entering it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_files_file_number
  ON public.import_files(forwarder_name, file_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_import_files_supplier_id
  ON public.import_files(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_import_files_shipment_group_id
  ON public.import_files(shipment_group_id) WHERE shipment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_files_arrival_date
  ON public.import_files(arrival_date DESC) WHERE deleted_at IS NULL;

-- Identifiers the future auto-matcher will search on.
CREATE INDEX IF NOT EXISTS idx_import_files_declaration_number
  ON public.import_files(declaration_number) WHERE declaration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_files_container_number
  ON public.import_files(container_number) WHERE container_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_files_supplier_invoice_number
  ON public.import_files(supplier_invoice_number) WHERE supplier_invoice_number IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Which orders a dossier covers.
-- ---------------------------------------------------------------------------
-- Many-to-many on purpose: one container commonly carries several orders, and
-- one order can be split across two shipments.
CREATE TABLE IF NOT EXISTS public.import_file_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_file_id UUID NOT NULL REFERENCES public.import_files(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  -- Share of the dossier's costs that belongs to this order, 0-1. NULL means
  -- "not decided yet"; the app then splits by goods value across linked orders.
  allocation_share NUMERIC CHECK (allocation_share >= 0 AND allocation_share <= 1),

  -- manual — a person linked it (everything, for now)
  -- auto   — reserved for the matcher that comes once enough data is collected
  matched_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (matched_by IN ('manual', 'auto')),
  -- What the match was based on, e.g. 'container+vessel'. Recorded so the
  -- eventual auto-matcher can be scored against real human decisions.
  match_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (import_file_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_import_file_orders_order_id
  ON public.import_file_orders(order_id);


-- ---------------------------------------------------------------------------
-- Cost breakdown.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_cost_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_file_id UUID NOT NULL REFERENCES public.import_files(id) ON DELETE CASCADE,

  -- The document this charge was read off, so every number is traceable back
  -- to a PDF. NULL for a charge entered by hand.
  document_id UUID REFERENCES public.purchase_documents(id) ON DELETE SET NULL,

  -- The forwarder's own line code where it has one (e.g. "14" = הובלה
  -- משילוח לעמילות on a Total Care invoice). Free text: codes differ per issuer.
  line_code TEXT,
  label TEXT NOT NULL,

  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'freight',        -- ocean/air freight
      'origin',         -- charges at origin
      'terminal',       -- port and terminal handling
      'customs_duty',   -- מכס
      'vat',            -- מע"מ (recoverable)
      'clearance',      -- customs broker fees
      'inland',         -- domestic transport
      'storage',        -- demurrage / warehousing
      'insurance',
      'fees',           -- assorted statutory fees
      'other'
    )),

  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  amount_ils NUMERIC,           -- converted at the document's own rate

  -- TRUE for import VAT: paid in cash but reclaimed, so it must stay out of
  -- landed cost even though it belongs in the payment total.
  is_recoverable BOOLEAN NOT NULL DEFAULT false,

  -- Set when this charge is ALSO a line on another document (typically the
  -- forwarder's summary invoice restating the freight invoice). Lines with this
  -- set are shown for traceability but excluded from every total.
  included_in_document_id UUID REFERENCES public.purchase_documents(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_cost_lines_import_file_id
  ON public.import_cost_lines(import_file_id);
CREATE INDEX IF NOT EXISTS idx_import_cost_lines_document_id
  ON public.import_cost_lines(document_id) WHERE document_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- The PDFs themselves stay in purchase_documents.
-- ---------------------------------------------------------------------------
-- Reusing the documents module means import PDFs get the existing storage
-- bucket, viewer, search, starring and trash for free — only the link to the
-- dossier is new.
ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS import_file_id UUID
    REFERENCES public.import_files(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.purchase_documents.import_file_id IS
  'Import dossier (import_files) this document belongs to — customs declarations, bills of lading, forwarder invoices';

CREATE INDEX IF NOT EXISTS idx_purchase_documents_import_file_id
  ON public.purchase_documents(import_file_id)
  WHERE import_file_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Keep updated_at honest.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_import_files_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER + the default PUBLIC execute grant would expose this over
-- PostgREST as /rpc/set_import_files_updated_at. It is only ever meant to run
-- from the trigger below, which executes as the table owner regardless, so
-- take the grant away from callable roles.
REVOKE EXECUTE ON FUNCTION public.set_import_files_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_import_files_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_import_files_updated_at() FROM authenticated;

DROP TRIGGER IF EXISTS trg_import_files_updated_at ON public.import_files;
CREATE TRIGGER trg_import_files_updated_at
  BEFORE UPDATE ON public.import_files
  FOR EACH ROW EXECUTE FUNCTION public.set_import_files_updated_at();


-- ---------------------------------------------------------------------------
-- RLS: internal collaborative tool — any authenticated user may read and write,
-- matching projects, shipment_groups and the rest of the procurement tables.
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_file_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read import files" ON public.import_files;
CREATE POLICY "Authenticated users can read import files" ON public.import_files
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert import files" ON public.import_files;
CREATE POLICY "Authenticated users can insert import files" ON public.import_files
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update import files" ON public.import_files;
CREATE POLICY "Authenticated users can update import files" ON public.import_files
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete import files" ON public.import_files;
CREATE POLICY "Authenticated users can delete import files" ON public.import_files
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read import file orders" ON public.import_file_orders;
CREATE POLICY "Authenticated users can read import file orders" ON public.import_file_orders
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert import file orders" ON public.import_file_orders;
CREATE POLICY "Authenticated users can insert import file orders" ON public.import_file_orders
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update import file orders" ON public.import_file_orders;
CREATE POLICY "Authenticated users can update import file orders" ON public.import_file_orders
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete import file orders" ON public.import_file_orders;
CREATE POLICY "Authenticated users can delete import file orders" ON public.import_file_orders
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read import cost lines" ON public.import_cost_lines;
CREATE POLICY "Authenticated users can read import cost lines" ON public.import_cost_lines
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert import cost lines" ON public.import_cost_lines;
CREATE POLICY "Authenticated users can insert import cost lines" ON public.import_cost_lines
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update import cost lines" ON public.import_cost_lines;
CREATE POLICY "Authenticated users can update import cost lines" ON public.import_cost_lines
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete import cost lines" ON public.import_cost_lines;
CREATE POLICY "Authenticated users can delete import cost lines" ON public.import_cost_lines
  FOR DELETE TO authenticated USING (true);
