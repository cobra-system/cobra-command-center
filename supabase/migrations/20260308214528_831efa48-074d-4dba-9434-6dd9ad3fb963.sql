
-- Distribution centers / warehouses table
CREATE TABLE public.distribution_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bonded', -- 'bonded' | 'main' | 'custom'
  city text,
  address text,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.distribution_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read centers" ON public.distribution_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert centers" ON public.distribution_centers FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update centers" ON public.distribution_centers FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete centers" ON public.distribution_centers FOR DELETE TO authenticated USING (is_manager());

-- Center contacts table
CREATE TABLE public.center_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid REFERENCES public.distribution_centers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.center_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read center contacts" ON public.center_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert center contacts" ON public.center_contacts FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update center contacts" ON public.center_contacts FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete center contacts" ON public.center_contacts FOR DELETE TO authenticated USING (is_manager());

-- Center inventory (product stock per center)
CREATE TABLE public.center_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid REFERENCES public.distribution_centers(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(center_id, product_id)
);

ALTER TABLE public.center_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read center inventory" ON public.center_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert center inventory" ON public.center_inventory FOR INSERT TO authenticated WITH CHECK (is_manager());
CREATE POLICY "Managers can update center inventory" ON public.center_inventory FOR UPDATE TO authenticated USING (is_manager());
CREATE POLICY "Managers can delete center inventory" ON public.center_inventory FOR DELETE TO authenticated USING (is_manager());

-- Seed default distribution centers
INSERT INTO public.distribution_centers (name, type, city, is_main) VALUES
  ('מרכז הפצה תל אביב', 'main', 'תל אביב', true),
  ('דלק מוטורס', 'bonded', NULL, false),
  ('פריזבי קרסו', 'bonded', NULL, false),
  ('לובינסקי', 'bonded', NULL, false);

-- Seed contacts from the image
INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('דלק מוטורס', 'אריה', 'מנהל', '054-757-5350'),
  ('דלק מוטורס', 'דוד ארביב', 'מנהל טכני', '054-916-9669'),
  ('דלק מוטורס', 'סער', 'מנהל מחסן', '050-408-3631')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('פריזבי קרסו', 'יקי עובד', 'מנהל', '054-681-5230'),
  ('פריזבי קרסו', 'מור דרעי', 'מנהל טכני', '052-526-9980'),
  ('פריזבי קרסו', 'אורטל', 'מנהל מחסן', '054-670-6727')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('לובינסקי', 'אבי', 'מנהל', '050-381-2345'),
  ('לובינסקי', '', 'מנהל טכני', ''),
  ('לובינסקי', 'פנל', 'מנהל מחסן', '054-536-7088')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Also add "יחידת היבואנים" contacts (associate with main center or create as a note)
-- These seem to be the importer unit, let's add as a separate bonded
INSERT INTO public.distribution_centers (name, type, city, is_main) VALUES
  ('יחידת היבואנים', 'bonded', NULL, false);

INSERT INTO public.center_contacts (center_id, name, role, phone)
SELECT dc.id, c.name, c.role, c.phone
FROM public.distribution_centers dc
CROSS JOIN (VALUES
  ('יחידת היבואנים', 'עמית גולדי', 'מנהל חטיבה', '054-440-0152'),
  ('יחידת היבואנים', 'רן אטיר', 'מנהל טכני חטיבה', '054-455-2109')
) AS c(center_name, name, role, phone)
WHERE dc.name = c.center_name;

-- Insert tasks for נועם
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
