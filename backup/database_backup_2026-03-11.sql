-- ============================================================================
-- Cobra Command Center - Full Database Backup
-- Generated: 2026-03-11
-- Database: Supabase PostgreSQL (project: pjruyvhtivbeikxrnipg)
-- ============================================================================
-- This backup contains:
--   1. Complete schema (types, tables, functions, triggers, RLS policies)
--   2. Seed/initial data from migrations
--
-- NOTE: Live row data could not be exported because no SUPABASE_SERVICE_ROLE_KEY
-- was available. RLS policies block the anon key from reading table data.
-- To export live data, run: ./backup/export_live_data.sh <SERVICE_ROLE_KEY>
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('MANAGER', 'WAREHOUSE_MANAGER', 'LOGISTICS', 'DRIVER');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'DRIVER',
  pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles for RLS checks
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  division TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  product_type TEXT NOT NULL,
  supplier TEXT,
  supplier_origin TEXT,
  shipping TEXT,
  purchase_price NUMERIC,
  monthly_sales NUMERIC,
  monthly_order NUMERIC,
  sale_price NUMERIC,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  incoming_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reorder_point INTEGER DEFAULT NULL,
  lead_time_days INTEGER DEFAULT NULL,
  monthly_sales_avg NUMERIC DEFAULT NULL,
  end_product_url TEXT DEFAULT NULL,
  end_product_image TEXT DEFAULT NULL,
  sap_code TEXT
);

-- Product components (for assembled products)
CREATE TABLE public.product_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  supplier TEXT,
  origin TEXT,
  stock_qty INTEGER,
  price NUMERIC,
  notes TEXT
);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  country TEXT,
  products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_time_days INTEGER DEFAULT NULL,
  payment_terms TEXT DEFAULT NULL,
  risk_level TEXT DEFAULT NULL,
  backup_supplier_id UUID REFERENCES public.suppliers(id) DEFAULT NULL,
  website TEXT,
  sap_code TEXT
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL DEFAULT 'P2',
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT,
  shipping TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  order_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  total_price NUMERIC,
  contact_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sap_doc_entry TEXT
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price NUMERIC
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'P2',
  status TEXT NOT NULL DEFAULT 'TODO',
  assignee_id UUID REFERENCES auth.users(id),
  assignee_name TEXT,
  due_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  milestone TEXT,
  deliverable TEXT,
  notes TEXT,
  is_daily BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Learning journal
CREATE TABLE public.learning_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'למידה',
  linked_type TEXT DEFAULT NULL,
  linked_id UUID DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase documents (PI/PO)
CREATE TABLE public.purchase_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('PI', 'PO')),
  supplier_id UUID REFERENCES public.suppliers(id),
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  total_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'ILS')),
  status TEXT NOT NULL DEFAULT 'ממתין לאישור',
  approval_date TIMESTAMPTZ,
  approved_by UUID,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL
);

-- Supplier payments
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  order_id UUID REFERENCES public.orders(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_type TEXT NOT NULL DEFAULT 'Full' CHECK (payment_type IN ('Deposit', 'Balance', 'Full')),
  status TEXT NOT NULL DEFAULT 'ממתין',
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_id UUID REFERENCES public.purchase_documents(id) ON DELETE SET NULL
);

-- Product issues
CREATE TABLE public.product_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reporter TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'בינוני' CHECK (severity IN ('נמוך', 'בינוני', 'גבוה', 'קריטי')),
  status TEXT NOT NULL DEFAULT 'פתוח' CHECK (status IN ('פתוח', 'בטיפול', 'נסגר')),
  resolution TEXT,
  resolved_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_number TEXT,
  diagnostic_source TEXT,
  diagnostic_steps JSONB,
  image_url TEXT
);

-- Supplier price quotes
CREATE TABLE public.supplier_price_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  moq INTEGER,
  lead_time_days INTEGER,
  valid_until DATE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Distribution centers
CREATE TABLE public.distribution_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bonded',
  city TEXT,
  address TEXT,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sap_code TEXT
);

-- Center contacts
CREATE TABLE public.center_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.distribution_centers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Center inventory
CREATE TABLE public.center_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.distribution_centers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  min_stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE(center_id, product_id)
);

-- Inventory transfers
CREATE TABLE public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_center_id UUID REFERENCES public.distribution_centers(id) ON DELETE SET NULL,
  to_center_id UUID REFERENCES public.distribution_centers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  transferred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SAP sync log
CREATE TABLE public.sap_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  sap_code TEXT,
  direction TEXT NOT NULL DEFAULT 'pull',
  status TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier contacts
CREATE TABLE public.supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance items
CREATE TABLE public.compliance_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'אישורים',
  expiry_date DATE,
  renewal_contact TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance product links (many-to-many)
CREATE TABLE public.compliance_product_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compliance_item_id UUID NOT NULL REFERENCES public.compliance_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(compliance_item_id, product_id)
);

-- Role definitions
CREATE TABLE public.role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  system_key TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'MANAGER'
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'DRIVER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_journal_updated_at BEFORE UPDATE ON public.learning_journal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_documents_updated_at BEFORE UPDATE ON public.purchase_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_payments_updated_at BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_issues_updated_at BEFORE UPDATE ON public.product_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_price_quotes_updated_at BEFORE UPDATE ON public.supplier_price_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_manager());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Managers can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_manager());

-- User roles
CREATE POLICY "Managers can read roles" ON public.user_roles
  FOR SELECT USING (public.is_manager() OR user_id = auth.uid());
CREATE POLICY "Managers can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_manager());

-- Products
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update products" ON public.products
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "Managers can delete products" ON public.products
  FOR DELETE TO authenticated USING (is_manager());

-- Product components
CREATE POLICY "Authenticated users can read components" ON public.product_components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert components" ON public.product_components
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update components" ON public.product_components
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "Managers can delete components" ON public.product_components
  FOR DELETE TO authenticated USING (is_manager());

-- Suppliers
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update suppliers" ON public.suppliers
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "Managers can delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated USING (is_manager());

-- Orders
CREATE POLICY "Authenticated users can read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert orders" ON public.orders
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update orders" ON public.orders
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "Managers can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (is_manager());

-- Order items
CREATE POLICY "Authenticated users can read order items" ON public.order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Managers can update order items" ON public.order_items
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete order items" ON public.order_items
  FOR DELETE TO authenticated USING (is_manager());

-- Tasks
CREATE POLICY "Authenticated users can read tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "Assignees and managers can update tasks" ON public.tasks
  FOR UPDATE USING (assignee_id = auth.uid() OR public.is_manager());
CREATE POLICY "Managers can delete tasks" ON public.tasks
  FOR DELETE USING (is_manager());

-- Learning journal
CREATE POLICY "Authenticated users can read journal" ON public.learning_journal
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own journal entries" ON public.learning_journal
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own or managers all journal" ON public.learning_journal
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_manager());
CREATE POLICY "Managers can delete journal entries" ON public.learning_journal
  FOR DELETE TO authenticated USING (is_manager() OR created_by = auth.uid());

-- Purchase documents
CREATE POLICY "Authenticated users can read documents" ON public.purchase_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert documents" ON public.purchase_documents
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update documents" ON public.purchase_documents
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete documents" ON public.purchase_documents
  FOR DELETE TO authenticated USING (is_manager());

-- Supplier payments
CREATE POLICY "Authenticated users can read payments" ON public.supplier_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert payments" ON public.supplier_payments
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update payments" ON public.supplier_payments
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete payments" ON public.supplier_payments
  FOR DELETE TO authenticated USING (is_manager());

-- Product issues
CREATE POLICY "Authenticated users can read issues" ON public.product_issues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert issues" ON public.product_issues
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Managers can update issues" ON public.product_issues
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete issues" ON public.product_issues
  FOR DELETE TO authenticated USING (is_manager());

-- Supplier price quotes
CREATE POLICY "Authenticated users can read quotes" ON public.supplier_price_quotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert quotes" ON public.supplier_price_quotes
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update quotes" ON public.supplier_price_quotes
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete quotes" ON public.supplier_price_quotes
  FOR DELETE TO authenticated USING (is_manager());

-- Distribution centers
CREATE POLICY "Authenticated users can read centers" ON public.distribution_centers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert centers" ON public.distribution_centers
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update centers" ON public.distribution_centers
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete centers" ON public.distribution_centers
  FOR DELETE TO authenticated USING (is_manager());

-- Center contacts
CREATE POLICY "Authenticated users can read center contacts" ON public.center_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert center contacts" ON public.center_contacts
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update center contacts" ON public.center_contacts
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete center contacts" ON public.center_contacts
  FOR DELETE TO authenticated USING (is_manager());

-- Center inventory
CREATE POLICY "Authenticated users can read center inventory" ON public.center_inventory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert center inventory" ON public.center_inventory
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update center inventory" ON public.center_inventory
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete center inventory" ON public.center_inventory
  FOR DELETE TO authenticated USING (is_manager());

-- Inventory transfers
CREATE POLICY "Authenticated users can read transfers" ON public.inventory_transfers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert transfers" ON public.inventory_transfers
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can delete transfers" ON public.inventory_transfers
  FOR DELETE TO authenticated USING (is_manager());

-- SAP sync log
CREATE POLICY "Authenticated users can read sync log" ON public.sap_sync_log
  FOR SELECT USING (true);
CREATE POLICY "Managers can insert sync log" ON public.sap_sync_log
  FOR INSERT WITH CHECK (is_manager());
CREATE POLICY "Managers can delete sync log" ON public.sap_sync_log
  FOR DELETE USING (is_manager());

-- Supplier contacts
CREATE POLICY "Authenticated users can read supplier contacts" ON public.supplier_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert supplier contacts" ON public.supplier_contacts
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update supplier contacts" ON public.supplier_contacts
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete supplier contacts" ON public.supplier_contacts
  FOR DELETE TO authenticated USING (is_manager());

-- Compliance items
CREATE POLICY "Authenticated users can read compliance items" ON public.compliance_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert compliance items" ON public.compliance_items
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update compliance items" ON public.compliance_items
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete compliance items" ON public.compliance_items
  FOR DELETE TO authenticated USING (is_manager());

-- Compliance product links
CREATE POLICY "Authenticated users can read compliance links" ON public.compliance_product_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert compliance links" ON public.compliance_product_links
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can delete compliance links" ON public.compliance_product_links
  FOR DELETE TO authenticated USING (is_manager());

-- Role definitions
CREATE POLICY "Authenticated users can read role definitions" ON public.role_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert role definitions" ON public.role_definitions
  FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update role definitions" ON public.role_definitions
  FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete role definitions" ON public.role_definitions
  FOR DELETE TO authenticated USING (is_manager());

-- ============================================================================
-- 7. REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- ============================================================================
-- 8. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-images', 'issue-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Anyone can read documents" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'documents');
CREATE POLICY "Authenticated users can delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- Storage policies for issue images
CREATE POLICY "Authenticated users can upload issue images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'issue-images');
CREATE POLICY "Anyone can read issue images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'issue-images');
CREATE POLICY "Managers can delete issue images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'issue-images' AND public.is_manager());

-- ============================================================================
-- 9. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 10. SEED DATA (from migrations)
-- ============================================================================

-- Role definitions
INSERT INTO public.role_definitions (name, system_key) VALUES
  ('מנהל מחסן', 'WAREHOUSE_MANAGER'),
  ('לוגיסטיקה', 'LOGISTICS'),
  ('נהג', 'DRIVER');

-- Distribution centers
INSERT INTO public.distribution_centers (name, type, city, is_main) VALUES
  ('מרכז הפצה תל אביב', 'main', 'תל אביב', true),
  ('דלק מוטורס', 'bonded', NULL, false),
  ('פריזבי קרסו', 'bonded', NULL, false),
  ('לובינסקי', 'bonded', NULL, false),
  ('יחידת היבואנים', 'bonded', NULL, false);

-- Center contacts: דלק מוטורס
INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('דלק מוטורס', 'אריה', 'מנהל', '054-757-5350'),
  ('דלק מוטורס', 'דוד ארביב', 'מנהל טכני', '054-916-9669'),
  ('דלק מוטורס', 'סער', 'מנהל מחסן', '050-408-3631')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Center contacts: פריזבי קרסו
INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('פריזבי קרסו', 'יקי עובד', 'מנהל', '054-681-5230'),
  ('פריזבי קרסו', 'מור דרעי', 'מנהל טכני', '052-526-9980'),
  ('פריזבי קרסו', 'אורטל', 'מנהל מחסן', '054-670-6727')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Center contacts: לובינסקי
INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('לובינסקי', 'אבי', 'מנהל', '050-381-2345'),
  ('לובינסקי', '', 'מנהל טכני', ''),
  ('לובינסקי', 'פנל', 'מנהל מחסן', '054-536-7088')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Center contacts: יחידת היבואנים
INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('יחידת היבואנים', 'עמית גולדי', 'מנהל חטיבה', '054-440-0152'),
  ('יחידת היבואנים', 'רן אטיר', 'מנהל טכני חטיבה', '054-455-2109')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Products (seeded from website migration)
INSERT INTO public.products (name, sku, category, product_type, stock_qty, incoming_qty, description, end_product_url, end_product_image)
VALUES
  ('CarPlay for Apple iOS', 'carplay-ios', 'מולטימדיה', 'מוגמר', 0, 0, 'CarPlay, בבסיסה, היא הדרך של אפל להביא את iOS אל הרכב שלכם ולשקף את האפליקציות הרלוונטיות.', 'https://cobra.co.il/products/multimedia', 'https://kgtpnkocukdpfeiqvign.supabase.co/storage/v1/object/public/product-images/2ac63038-ceed-41a4-98e3-a903e8880d48.jpg'),
  ('חבילת סמארטפון כוללת', 'smartphone-pkg', 'נוחות וקישוריות', 'מוגמר', 0, 0, 'חבילה מקיפה לחיבור הסמארטפון', 'https://cobra.co.il/products/comfort', NULL);

-- Tasks for נועם
INSERT INTO public.tasks (title, assignee_name, priority, status, is_daily) VALUES
  ('חתימה דיגיטלית', 'נועם', 'גבוה', 'TODO', false),
  ('חתימה רגילה', 'נועם', 'גבוה', 'TODO', false),
  ('העברה של כל הסיסמאות שיש', 'נועם', 'דחוף', 'TODO', false),
  ('העברת סרטונים של הסבר על כל מערכת', 'נועם', 'גבוה', 'TODO', false),
  ('פתיחה של משתמש וסיסמא לכל מערכת של קוברה', 'נועם', 'דחוף', 'TODO', false),
  ('פתיחה של משתמש בSAP', 'נועם', 'דחוף', 'TODO', false),
  ('מחשב נייח?', 'נועם', 'בינוני', 'TODO', false),
  ('הסבר על תיק יבוא - מה צריך להיות', 'נועם', 'גבוה', 'TODO', false),
  ('פתיחת קבוצות עם כל הספקים החשובים בWeChat', 'נועם', 'גבוה', 'TODO', false),
  ('קיבוץ תקיית נהלים של כל הדברים האפשרים לפי מוצר', 'נועם', 'בינוני', 'TODO', false),
  ('העברה של המדריכים למשתמש שיש לכל הדברים', 'נועם', 'בינוני', 'TODO', false),
  ('רשימת הסכמים מוכנים של כל הספקים הגדולים', 'נועם', 'גבוה', 'TODO', false),
  ('רשימת ספקים כללי של כל מה שיש', 'נועם', 'בינוני', 'TODO', false),
  ('פורטל סלקום - סיסמא', 'נועם', 'דחוף', 'TODO', false),
  ('פורטל פלאפון - סיסמא', 'נועם', 'דחוף', 'TODO', false);

COMMIT;
