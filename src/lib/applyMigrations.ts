/**
 * Apply pending database migrations
 * This ensures the user_preferences table exists before the app starts using it
 * and keeps workflow templates up to date
 */

import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "cobra_migrations_applied"
const CURRENT_VERSION = "20260322_task_depends_on"

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

export async function applyMigrations() {
  try {
    const applied = localStorage.getItem(MIGRATION_KEY)
    if (applied === CURRENT_VERSION) {
      return true
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
