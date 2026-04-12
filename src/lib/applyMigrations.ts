/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Apply pending database migrations
 * This ensures the user_preferences table exists before the app starts using it
 * and keeps workflow templates up to date
 */

import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "cobra_migrations_applied"
const CURRENT_VERSION = "20260412_create_warehouse_zones"

const INTERNATIONAL_TEMPLATE_ID = "b5a990c9-579d-4d9f-8e9a-90a8856ad00b";
const ISRAEL_TEMPLATE_ID = "c7b881d0-68ae-4e0a-9f1b-a1b9967be11c";

async function migrateWorkflowTemplates() {
  // Update international procurement workflow
  const internationalSteps = [
    { action: "upload_file", index: 0, name: "קבלת PI מספק", required: true },
    { action: "approve",     index: 1, name: "אישור בישיבת רכש", required: true },
    { action: "send_email",  index: 2, name: "שליחת PI למחלקת פיננסים", required: true },
    { action: "input_eta",   index: 3, name: "שליחת SWIFT לספק + עדכון ETA במערכת", required: true },
    { action: "send_email",  index: 4, name: "קליטת סחורה + מייל לאחרית SAP אלינור", required: true },
    { action: "confirm",     index: 5, name: "אישור קליטה במלאי", required: true },
  ];

  await supabase
    .from("workflow_templates")
    .update({ steps: internationalSteps })
    .eq("id", INTERNATIONAL_TEMPLATE_ID);

  // Update Israeli procurement workflow (4 steps only)
  const israelSteps = [
    { action: "confirm",    index: 0, name: "קבלת בקשה להזמנה", required: true },
    { action: "approve",    index: 1, name: "הזמנה אושרה",       required: true },
    { action: "send_email", index: 2, name: "שליחה לספק",        required: true },
    { action: "confirm",    index: 3, name: "נשלחה לספק",        required: true },
  ];

  await supabase
    .from("workflow_templates")
    .update({ steps: israelSteps })
    .eq("id", ISRAEL_TEMPLATE_ID);

  console.log("✅ Workflow templates updated");
}

async function fixIsraeliOrderWorkflows() {
  // Find workflow instances that use the international template
  // but belong to orders with Israeli suppliers
  const { data: instances } = await supabase
    .from("workflow_instances")
    .select("id, order_id, template_id, current_step")
    .eq("template_id", INTERNATIONAL_TEMPLATE_ID)
    .not("order_id", "is", null);

  if (!instances || instances.length === 0) return;

  // Get order details with supplier info
  const orderIds = instances.map(i => i.order_id).filter(Boolean);
  const { data: orders } = await supabase
    .from("orders")
    .select("id, supplier_id")
    .in("id", orderIds);

  if (!orders) return;

  // Get supplier countries
  const supplierIds = orders.map(o => o.supplier_id).filter(Boolean);
  if (supplierIds.length === 0) return;

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, country")
    .in("id", supplierIds);

  if (!suppliers) return;

  const israelSupplierIds = new Set(
    suppliers.filter(s => s.country === "ישראל").map(s => s.id)
  );

  // Find orders with Israeli suppliers
  const israelOrderIds = new Set(
    orders.filter(o => o.supplier_id && israelSupplierIds.has(o.supplier_id)).map(o => o.id)
  );

  // Fix instances that should use Israeli workflow
  const instancesToFix = instances.filter(i => i.order_id && israelOrderIds.has(i.order_id));

  for (const instance of instancesToFix) {
    // Delete old step logs
    await supabase
      .from("workflow_step_logs")
      .delete()
      .eq("instance_id", instance.id);

    // Update to Israeli template and reset step
    await supabase
      .from("workflow_instances")
      .update({
        template_id: ISRAEL_TEMPLATE_ID,
        current_step: 0,
        status: "active",
      })
      .eq("id", instance.id);
  }

  if (instancesToFix.length > 0) {
    console.log(`✅ Fixed ${instancesToFix.length} Israeli order workflow(s)`);
  }
}

async function verifyTableExists(tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select("id").limit(1);
  // If table doesn't exist, error code is "42P01" or message contains "relation"
  if (error && (error.code === "42P01" || error.message?.includes("relation") || error.message?.includes("schema cache"))) {
    return false;
  }
  return true;
}

export async function applyMigrations() {
  try {
    const applied = localStorage.getItem(MIGRATION_KEY)

    // Even if localStorage says current version, verify critical tables actually exist
    if (applied === CURRENT_VERSION) {
      const goalsExist = await verifyTableExists("goals");
      const wasteItemsExist = await verifyTableExists("waste_items");
      const warehouseZonesExist = await verifyTableExists("warehouse_zones");
      if (goalsExist && wasteItemsExist && warehouseZonesExist) {
        return true;
      }
      // Table doesn't exist despite localStorage — clear flag and re-run
      console.warn("⚠️ Required tables not found despite migration flag. Re-running migrations...");
      localStorage.removeItem(MIGRATION_KEY);
    }

    // Migration 1: Create user_preferences table
    if (applied !== "20260317_create_user_preferences" && applied !== CURRENT_VERSION) {
      const { error } = await supabase.rpc("create_user_preferences_table_if_not_exists" as any)
      if (error) {
        console.warn("RPC function not found, attempting direct table creation")
        console.log("user_preferences table may need to be created via Supabase dashboard")
      }
    }

    // Migration 2: Update workflow templates and fix Israeli orders
    await migrateWorkflowTemplates();
    await fixIsraeliOrderWorkflows();

    // Migration 3: Add depends_on column to tasks
    if (applied !== CURRENT_VERSION) {
      try {
        await supabase.rpc("exec_sql" as any, {
          sql: "ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on uuid[] DEFAULT '{}';"
        });
      } catch {
        console.warn("depends_on column may need to be added via Supabase dashboard");
      }
    }

    // Migration 4: Create goals table
    const goalsSqls = [
      `CREATE TABLE IF NOT EXISTS public.goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#0e7490',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
      `ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goals' AND policyname='Authenticated users can read goals') THEN
          CREATE POLICY "Authenticated users can read goals" ON public.goals FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goals' AND policyname='Managers can insert goals') THEN
          CREATE POLICY "Managers can insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.is_manager());
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goals' AND policyname='Managers can update goals') THEN
          CREATE POLICY "Managers can update goals" ON public.goals FOR UPDATE TO authenticated USING (public.is_manager());
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goals' AND policyname='Managers can delete goals') THEN
          CREATE POLICY "Managers can delete goals" ON public.goals FOR DELETE TO authenticated USING (public.is_manager());
        END IF;
      END $$;`,
    ];
    for (const sql of goalsSqls) {
      try {
        await supabase.rpc("exec_sql" as any, { sql });
      } catch {
        console.warn("goals migration step may need to be applied via Supabase dashboard");
      }
    }

    // Verify the goals table was actually created before marking migration as complete
    const goalsCreated = await verifyTableExists("goals");
    if (!goalsCreated) {
      console.error(
        "❌ Goals table was not created. Please run the following SQL in Supabase SQL Editor:\n\n" +
        "CREATE TABLE IF NOT EXISTS public.goals (\n" +
        "  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
        "  name TEXT NOT NULL UNIQUE,\n" +
        "  color TEXT NOT NULL DEFAULT '#0e7490',\n" +
        "  sort_order INT NOT NULL DEFAULT 0,\n" +
        "  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n" +
        ");\n\n" +
        "ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;\n\n" +
        "CREATE POLICY \"Authenticated users can read goals\" ON public.goals FOR SELECT TO authenticated USING (true);\n" +
        "CREATE POLICY \"Managers can insert goals\" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.is_manager());\n" +
        "CREATE POLICY \"Managers can update goals\" ON public.goals FOR UPDATE TO authenticated USING (public.is_manager());\n" +
        "CREATE POLICY \"Managers can delete goals\" ON public.goals FOR DELETE TO authenticated USING (public.is_manager());"
      );
      // Do NOT set localStorage — migration will retry on next load
      return false;
    }

    // Migration 5: Allow any authenticated user to create tasks
    // Drop both old policy variants and create a permissive one
    let taskPolicyApplied = false;
    const taskPolicySqls = [
      `DROP POLICY IF EXISTS "Managers can insert tasks" ON public.tasks;`,
      `DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;`,
      `CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);`,
    ];
    for (const sql of taskPolicySqls) {
      try {
        const { error } = await supabase.rpc("exec_sql" as any, { sql });
        if (error) {
          console.warn("Task policy migration failed:", error.message);
          break;
        }
        taskPolicyApplied = true;
      } catch {
        console.warn(
          "⚠️ tasks insert policy migration failed. Please run this SQL in Supabase SQL Editor:\n\n" +
          'DROP POLICY IF EXISTS "Managers can insert tasks" ON public.tasks;\n' +
          'DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;\n' +
          'CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);'
        );
        break;
      }
    }

    if (!taskPolicyApplied) {
      console.error("❌ Task insert policy was not updated. Non-manager users may not be able to create tasks.");
      // Do NOT set localStorage — migration will retry on next load
      return false;
    }

    // Migration 6: Create waste_items table
    const wasteItemsSqls = [
      `CREATE TABLE IF NOT EXISTS public.waste_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_name TEXT NOT NULL,
        sku TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 0,
        in_use BOOLEAN NOT NULL DEFAULT false,
        recommendations TEXT DEFAULT '',
        created_by UUID,
        created_by_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
      `ALTER TABLE public.waste_items ENABLE ROW LEVEL SECURITY;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_items' AND policyname='Authenticated users can read waste_items') THEN
          CREATE POLICY "Authenticated users can read waste_items" ON public.waste_items FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_items' AND policyname='Authenticated users can insert waste_items') THEN
          CREATE POLICY "Authenticated users can insert waste_items" ON public.waste_items FOR INSERT TO authenticated WITH CHECK (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_items' AND policyname='Authenticated users can update waste_items') THEN
          CREATE POLICY "Authenticated users can update waste_items" ON public.waste_items FOR UPDATE TO authenticated USING (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_items' AND policyname='Authenticated users can delete waste_items') THEN
          CREATE POLICY "Authenticated users can delete waste_items" ON public.waste_items FOR DELETE TO authenticated USING (true);
        END IF;
      END $$;`,
    ];
    for (const sql of wasteItemsSqls) {
      try {
        const { error } = await supabase.rpc("exec_sql" as any, { sql });
        if (error) {
          console.warn("waste_items migration step failed:", error.message);
        }
      } catch {
        console.warn("waste_items migration step may need to be applied via Supabase dashboard");
      }
    }

    // Verify the waste_items table was actually created
    const wasteItemsCreated = await verifyTableExists("waste_items");
    if (!wasteItemsCreated) {
      console.error(
        "❌ waste_items table was not created. Please run the following SQL in Supabase SQL Editor:\n\n" +
        "CREATE TABLE IF NOT EXISTS public.waste_items (\n" +
        "  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
        "  product_name TEXT NOT NULL,\n" +
        "  sku TEXT NOT NULL DEFAULT '',\n" +
        "  quantity INTEGER NOT NULL DEFAULT 0,\n" +
        "  in_use BOOLEAN NOT NULL DEFAULT false,\n" +
        "  recommendations TEXT DEFAULT '',\n" +
        "  created_by UUID,\n" +
        "  created_by_name TEXT,\n" +
        "  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n" +
        "  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n" +
        ");\n\n" +
        "ALTER TABLE public.waste_items ENABLE ROW LEVEL SECURITY;\n\n" +
        "CREATE POLICY \"Authenticated users can read waste_items\" ON public.waste_items FOR SELECT TO authenticated USING (true);\n" +
        "CREATE POLICY \"Authenticated users can insert waste_items\" ON public.waste_items FOR INSERT TO authenticated WITH CHECK (true);\n" +
        "CREATE POLICY \"Authenticated users can update waste_items\" ON public.waste_items FOR UPDATE TO authenticated USING (true);\n" +
        "CREATE POLICY \"Authenticated users can delete waste_items\" ON public.waste_items FOR DELETE TO authenticated USING (true);"
      );
      // Do NOT set localStorage — migration will retry on next load
      return false;
    }

    // Migration 7: Add allowed_product_ids to profiles for product-scoped access
    try {
      await supabase.rpc("exec_sql" as any, {
        sql: "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_product_ids text[] DEFAULT NULL;"
      });
    } catch {
      console.warn("allowed_product_ids column may need to be added via Supabase dashboard");
    }

    // Migration 8: Create warehouse_zones table + fix warehouse_zone_products RLS
    const warehouseZonesSqls = [
      // Fix warehouse_zone_products policies
      `CREATE TABLE IF NOT EXISTS public.warehouse_zone_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        zone_id TEXT NOT NULL,
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(zone_id, product_id)
      );`,
      `ALTER TABLE public.warehouse_zone_products ENABLE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS "Authenticated users can view warehouse zone products" ON public.warehouse_zone_products;`,
      `DROP POLICY IF EXISTS "Authenticated users can manage warehouse zone products" ON public.warehouse_zone_products;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zone_products' AND policyname='wzp_select') THEN
          CREATE POLICY "wzp_select" ON public.warehouse_zone_products FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zone_products' AND policyname='wzp_insert') THEN
          CREATE POLICY "wzp_insert" ON public.warehouse_zone_products FOR INSERT TO authenticated WITH CHECK (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zone_products' AND policyname='wzp_delete') THEN
          CREATE POLICY "wzp_delete" ON public.warehouse_zone_products FOR DELETE TO authenticated USING (true);
        END IF;
      END $$;`,
      // Create warehouse_zones table
      `CREATE TABLE IF NOT EXISTS public.warehouse_zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#9E9E9E',
        text_color TEXT NOT NULL DEFAULT '#ffffff',
        grid_row TEXT NOT NULL,
        grid_col TEXT NOT NULL,
        zone_type TEXT NOT NULL DEFAULT 'storage',
        icon TEXT,
        is_non_product BOOLEAN NOT NULL DEFAULT false,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
      `ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zones' AND policyname='wz_select') THEN
          CREATE POLICY "wz_select" ON public.warehouse_zones FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zones' AND policyname='wz_insert') THEN
          CREATE POLICY "wz_insert" ON public.warehouse_zones FOR INSERT TO authenticated WITH CHECK (public.has_module_edit('logistics-map'));
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zones' AND policyname='wz_update') THEN
          CREATE POLICY "wz_update" ON public.warehouse_zones FOR UPDATE TO authenticated USING (public.has_module_edit('logistics-map'));
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_zones' AND policyname='wz_delete') THEN
          CREATE POLICY "wz_delete" ON public.warehouse_zones FOR DELETE TO authenticated USING (public.has_module_edit('logistics-map'));
        END IF;
      END $$;`,
      // Seed default zones
      `INSERT INTO public.warehouse_zones (id,name,color,text_color,grid_row,grid_col,zone_type,icon,is_non_product,sort_order) VALUES
        ('light-buttons',E'כפתור לייט','#4a4a4a','#ffffff','1 / 3','1 / 5','shelving',NULL,false,0),
        ('lcd-g4-buttons',E'כפתור LCD + G4','#4a4a4a','#ffffff','3 / 5','1 / 5','shelving',NULL,false,1),
        ('phone-stands',E'מעמדי טלפון\nחישבי בדורם','#4a4a4a','#ffffff','5 / 7','1 / 5','shelving',NULL,false,2),
        ('head-mounts',E'תושבת ראש\nמרכז בלוק','#4a4a4a','#ffffff','7 / 9','1 / 5','shelving',NULL,false,3),
        ('cobratv-screens-1',E'CobraTv + מסכים','#F4A89A','#1a1a1a','9 / 11','1 / 5','shelving',NULL,false,4),
        ('cobratv-screens-2',E'CobraTv + מסכים','#F4A89A','#1a1a1a','11 / 13','1 / 5','shelving',NULL,false,5),
        ('g4-android-screens-1',E'G4 מסכי אנדרויד','#b87333','#ffffff','13 / 15','1 / 5','shelving',NULL,false,6),
        ('g4-android-screens-2',E'G4 מסכי אנדרויד','#b87333','#ffffff','15 / 17','1 / 5','shelving',NULL,false,7),
        ('g5-android-screens-1',E'G5 מסכי אנדרויד','#b87333','#ffffff','17 / 19','1 / 5','shelving',NULL,false,8),
        ('g5-android-screens-2',E'G5 מסכי אנדרויד','#b87333','#ffffff','19 / 21','1 / 5','shelving',NULL,false,9),
        ('smartphone-stands',E'מעמדים מעודרים לסמארטפון','#c4956a','#ffffff','1 / 3','5 / 10','storage',NULL,false,10),
        ('multimedia-systems',E'מערכות מולטימדיה שונות','#8BC34A','#1a1a1a','1 / 3','10 / 19','storage',NULL,false,11),
        ('id-storage-1',E'ID','#8B1A1A','#ffffff','5 / 8','5 / 8','storage',NULL,false,12),
        ('id-storage-2',E'ID','#8B1A1A','#ffffff','5 / 8','8 / 10','storage',NULL,false,13),
        ('id-storage-3',E'ID','#8B1A1A','#ffffff','5 / 8','10 / 12','storage',NULL,false,14),
        ('erm-1',E'E.R.M','#FFD600','#1a1a1a','8 / 11','5 / 8','product',NULL,false,15),
        ('erm-2',E'E.R.M','#FFD600','#1a1a1a','8 / 11','8 / 11','product',NULL,false,16),
        ('erm-3',E'E.R.M','#FFD600','#1a1a1a','8 / 11','11 / 14','product',NULL,false,17),
        ('gray-storage-1',E'אחסון','#9E9E9E','#ffffff','3 / 8','12 / 15','storage',NULL,false,18),
        ('gray-storage-2',E'אחסון','#78909C','#ffffff','3 / 8','15 / 19','storage',NULL,false,19),
        ('r8',E'R8\nבליינד ספורט','#3b5fe6','#ffffff','8 / 11','14 / 17','product',NULL,false,20),
        ('ks400',E'KS400','#22c55e','#ffffff','8 / 11','17 / 19','product',NULL,false,21),
        ('s400',E'S400','#f97316','#ffffff','8 / 11','19 / 21','product',NULL,false,22),
        ('z4k',E'Z4K','#06b6d4','#ffffff','8 / 11','21 / 23','product',NULL,false,23),
        ('trunk-spare-parts',E'מרימר תא מטען\nחשמלי\n+\nחלקי חילוף','#9C27B0','#ffffff','1 / 15','21 / 25','storage',NULL,false,24),
        ('erm-bottom',E'E.R.M','#FFD600','#1a1a1a','17 / 21','5 / 8','product',NULL,false,25),
        ('safe',E'כספת','#3f51b5','#ffffff','17 / 21','8 / 10','utility','Lock',true,26),
        ('work-desk',E'שולחן עבודה','#757575','#ffffff','17 / 21','10 / 15','utility',NULL,true,27),
        ('entrance',E'כניסה למחסן\nלוגיסטר קוברה ת״א','#BDBDBD','#424242','13 / 21','15 / 25','entrance','DoorOpen',true,28)
      ON CONFLICT (id) DO NOTHING;`,
    ];

    for (const sql of warehouseZonesSqls) {
      try {
        const { error } = await supabase.rpc("exec_sql" as any, { sql });
        if (error) {
          console.warn("warehouse_zones migration step failed:", error.message);
        }
      } catch {
        console.warn("warehouse_zones migration step may need to be applied via Supabase dashboard");
      }
    }

    const warehouseZonesCreated = await verifyTableExists("warehouse_zones");
    if (!warehouseZonesCreated) {
      console.error("❌ warehouse_zones table was not created. Please apply migration 20260412100000 via Supabase dashboard.");
      return false;
    }

    localStorage.setItem(MIGRATION_KEY, CURRENT_VERSION)
    console.log("✅ All migrations applied successfully")
    return true
  } catch (error) {
    console.error("Error applying migrations:", error)
    return false
  }
}

/**
 * Alternative: Manual migration via Supabase dashboard
 *
 * Copy and paste this SQL into Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS public.user_preferences (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   page_name text NOT NULL,
 *   sort_field text,
 *   sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
 *   filters jsonb DEFAULT '{}'::jsonb,
 *   created_at timestamp with time zone DEFAULT now(),
 *   updated_at timestamp with time zone DEFAULT now(),
 *   UNIQUE(user_id, page_name)
 * );
 *
 * CREATE INDEX idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);
 *
 * ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can read their own preferences"
 *   ON public.user_preferences FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert their own preferences"
 *   ON public.user_preferences FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update their own preferences"
 *   ON public.user_preferences FOR UPDATE
 *   USING (auth.uid() = user_id)
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can delete their own preferences"
 *   ON public.user_preferences FOR DELETE
 *   USING (auth.uid() = user_id);
 *
 * CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = now();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER update_user_preferences_updated_at
 *   BEFORE UPDATE ON public.user_preferences
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_user_preferences_updated_at();
 */
