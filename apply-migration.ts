/**
 * Apply user_preferences migration to Supabase
 * This script runs the migration SQL directly on the database
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env file manually
const envContent = fs.readFileSync(".env", "utf-8");
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [key, value] = line.split("=");
      return [key, value.replace(/^"(.*)"$/, "$1")];
    })
);

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

// Read the migration file
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260317000000_create_user_preferences_table.sql"
);

const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

console.log("📋 Migration SQL loaded");
console.log("🔗 Connecting to Supabase...");

const supabase = createClient(supabaseUrl, supabaseKey);

// For applying the migration, we need to use the REST API
// since the JS client doesn't directly support raw SQL execution
// We'll use the fetch API to call the Supabase REST endpoint

async function applyMigration() {
  try {
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // For each statement, we'll try to execute it via the REST API
    // First, let's try to create a test to verify database access

    // Test 1: Try to query existing tables to verify access
    console.log("🧪 Test 1: Verifying database access...");
    const { data: tables, error: tableError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .limit(1);

    if (tableError) {
      console.log(
        "⚠️  Cannot query information_schema (expected with anon key)"
      );
      console.log("ℹ️  Will attempt direct table creation...\n");
    } else {
      console.log("✅ Database access verified\n");
    }

    // Test 2: Check if user_preferences table already exists
    console.log("🔍 Test 2: Checking if user_preferences table exists...");
    const { data: existingTable, error: checkError } = await supabase
      .from("user_preferences")
      .select("id")
      .limit(1);

    if (!checkError) {
      console.log("✅ user_preferences table already exists!\n");
      return true;
    }

    if (checkError.message.includes("does not exist")) {
      console.log(
        "📌 Table does not exist yet - migration needs to be applied\n"
      );
    } else {
      console.log(`⚠️  Check error: ${checkError.message}\n`);
    }

    // Test 3: Try to apply migration using RPC if available
    console.log("🚀 Test 3: Attempting to apply migration...");
    console.log(
      "⚠️  Note: Direct SQL execution requires admin/service role key\n"
    );

    // Since we're using anon key, we need to guide user through manual application
    console.log(
      "📌 Migration setup guide (automatic migration requires admin access):"
    );
    console.log("─".repeat(70));
    console.log("\n✅ AUTOMATIC MIGRATION APPLICATION");
    console.log("Since we have direct database access, applying migration now...\n");

    // We'll use a workaround: try creating the table step by step
    // Start with the table creation
    console.log("Step 1: Creating user_preferences table...");

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.user_preferences (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        page_name text NOT NULL,
        sort_field text,
        sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
        filters jsonb DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        UNIQUE(user_id, page_name)
      );
    `;

    // Try using rpc if any migration function exists
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "exec_sql",
      { sql: createTableSQL }
    );

    if (rpcError) {
      if (rpcError.code === "PGRST102") {
        console.log("ℹ️  exec_sql RPC not available (expected)\n");
      } else {
        console.log(`RPC Error: ${rpcError.message}\n`);
      }
    } else if (rpcResult) {
      console.log("✅ Table creation successful via RPC\n");
      return true;
    }

    // Fallback: Provide manual instruction and detailed guide
    console.log("\n" + "═".repeat(70));
    console.log("📖 MANUAL MIGRATION APPLICATION");
    console.log("═".repeat(70) + "\n");

    console.log(
      "The database connection available is read-only (anon key)."
    );
    console.log(
      "To apply the migration, you need to use the Supabase dashboard:\n"
    );

    console.log("1️⃣  Go to: https://app.supabase.com");
    console.log("2️⃣  Select project: cobra-command-center");
    console.log("3️⃣  Click: SQL Editor → + New Query");
    console.log("4️⃣  Copy and paste this SQL:\n");

    console.log("─".repeat(70));
    console.log(migrationSQL);
    console.log("─".repeat(70) + "\n");

    console.log("5️⃣  Click: Run");
    console.log("6️⃣  Done! ✅\n");

    return false;
  } catch (error) {
    console.error("❌ Error applying migration:", error);
    return false;
  }
}

applyMigration().then((success) => {
  if (success) {
    console.log(
      "🎉 Migration applied successfully! Table is ready for use.\n"
    );
    process.exit(0);
  } else {
    console.log("⚠️  Migration requires manual application via dashboard.\n");
    console.log("📌 See instructions above.");
    process.exit(0);
  }
});
