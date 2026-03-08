
-- User roles enum
CREATE TYPE public.app_role AS ENUM ('MANAGER', 'WAREHOUSE_MANAGER', 'LOGISTICS', 'DRIVER');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'DRIVER',
  pin TEXT, -- 4-digit PIN for employee login
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table for RLS checks
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  division TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  product_type TEXT NOT NULL, -- 'מוגמר' | 'מורכב'
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  country TEXT, -- 'ישראל' | 'חול'
  products TEXT, -- comma-separated
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL DEFAULT 'P2', -- P0, P1, P2, P3
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT,
  shipping TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ORDERED, SHIPPED, ARRIVED, CANCELLED
  order_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  total_price NUMERIC,
  contact_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'P2', -- P0, P1, P2, P3
  status TEXT NOT NULL DEFAULT 'TODO', -- TODO, IN_PROGRESS, DONE, BLOCKED
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

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

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

-- Profiles: users can read their own, managers can read all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_manager());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Managers can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_manager());

-- User roles: only managers can manage
CREATE POLICY "Managers can read roles" ON public.user_roles
  FOR SELECT USING (public.is_manager() OR user_id = auth.uid());

CREATE POLICY "Managers can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_manager());

-- Products: all authenticated users can read, managers can write
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update products" ON public.products
  FOR UPDATE USING (public.is_manager());

-- Product components: same as products
CREATE POLICY "Authenticated users can read components" ON public.product_components
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert components" ON public.product_components
  FOR INSERT WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update components" ON public.product_components
  FOR UPDATE USING (public.is_manager());

-- Suppliers: all authenticated can read, managers can write
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update suppliers" ON public.suppliers
  FOR UPDATE USING (public.is_manager());

-- Orders: all authenticated can read, managers can write
CREATE POLICY "Authenticated users can read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert orders" ON public.orders
  FOR INSERT WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update orders" ON public.orders
  FOR UPDATE USING (public.is_manager());

-- Order items: same as orders
CREATE POLICY "Authenticated users can read order items" ON public.order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (public.is_manager());

-- Tasks: all authenticated can read, managers can insert, assignees and managers can update
CREATE POLICY "Authenticated users can read tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.is_manager());

CREATE POLICY "Assignees and managers can update tasks" ON public.tasks
  FOR UPDATE USING (assignee_id = auth.uid() OR public.is_manager());

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
