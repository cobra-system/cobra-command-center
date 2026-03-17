/**
 * Migration Script: Apply user_preferences table
 * 
 * Usage:
 *   1. Set DATABASE_PASSWORD env var: export DATABASE_PASSWORD="your-password"
 *   2. Run: npx tsx apply-migration.ts
 * 
 * Or manually:
 *   1. Visit: https://app.supabase.com
 *   2. Select: cobra-command-center project
 *   3. SQL Editor → + New Query
 *   4. Copy content from: supabase/migrations/20260317000000_create_user_preferences_table.sql
 *   5. Click: Run
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://ljpdwezgahrrffnwajho.supabase.co";
const SERVICE_ROLE_KEY = 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcGR3ZXpnYWhycmZmbndhamhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxNjI0MSwiZXhwIjoyMDg4NTkyMjQxfQ.lfXs1ZhOrjb--2l9lIs8KgQwqtGx49l7k0Fk1E0rpCw";

async function applyMigration() {
  console.log("🔧 Applying user_preferences migration...\n");

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      headers: {
        "x-client-info": "migration-script",
      },
    });

    // Read migration SQL
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260317000000_create_user_preferences_table.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    // Execute the entire migration
    console.log("📋 Executing SQL statements...\n");

    const { error } = await supabase.rpc("exec", {
      sql: migrationSql,
    });

    if (error) {
      // If exec RPC doesn't exist, show manual instructions
      console.log("📌 Cannot use RPC method. Please apply migration manually:\n");
      console.log("1. Visit: https://app.supabase.com");
      console.log("2. Select: cobra-command-center project");
      console.log("3. SQL Editor → + New Query");
      console.log("4. Copy SQL from: supabase/migrations/20260317000000_create_user_preferences_table.sql");
      console.log("5. Click: Run\n");
      return;
    }

    console.log("✨ Migration applied successfully!\n");
    console.log("📊 Created:");
    console.log("  ✅ user_preferences table");
    console.log("  ✅ RLS policies (4 policies)");
    console.log("  ✅ Index on (user_id, page_name)");
    console.log("  ✅ Auto-update trigger for updated_at\n");

    console.log("🚀 Next steps:");
    console.log("  1. npm run build");
    console.log("  2. Deploy to production");
    console.log("  3. Test in the application\n");
  } catch (err) {
    console.error("❌ Error applying migration:");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }

    console.log("\n📌 Manual application instructions:");
    console.log("1. Visit: https://app.supabase.com");
    console.log("2. Select: cobra-command-center project");
    console.log("3. SQL Editor → + New Query");
    console.log("4. Copy SQL from: supabase/migrations/20260317000000_create_user_preferences_table.sql");
    console.log("5. Click: Run\n");

    process.exit(1);
  }
}

applyMigration();
