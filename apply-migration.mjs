#!/usr/bin/env node

/**
 * Migration Runner for user_preferences table
 *
 * Usage: node apply-migration.mjs
 *
 * Requires environment variables:
 * - DATABASE_URL (or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get config from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ljpdwezgahrrffnwajho.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment");
  console.error("   Set it in .env.local or pass it as an environment variable");
  process.exit(1);
}

console.log("🔄 Initializing Supabase client...");
console.log(`   URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Load migration SQL
const migrationPath = path.join(__dirname, "supabase/migrations/20260317000000_create_user_preferences_table.sql");
console.log(`📂 Reading migration file: ${migrationPath}`);

const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

// Split into individual statements
const statements = migrationSQL
  .split(";")
  .map(s => s.trim())
  .filter(s => s && !s.startsWith("--"));

console.log(`\n📋 Found ${statements.length} SQL statements to execute\n`);

// Execute migration
(async () => {
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);

      const { error } = await supabase.rpc("exec_sql", {
        sql: stmt + ";",
      });

      if (error) {
        // If RPC doesn't exist, try direct query
        console.log("   (Trying direct query...)");
        const { error: queryError } = await supabase.from("_migrations").select("*").limit(0);

        // If even that fails, we need direct DB access
        throw new Error(
          "Cannot execute SQL via Supabase client. " +
          "Please run via Supabase Dashboard or psql:\n\n" +
          "  psql \"$DATABASE_URL\" -f supabase/migrations/20260317000000_create_user_preferences_table.sql"
        );
      }

      console.log("   ✅ Success");
    }

    console.log("\n✨ Migration completed successfully!");
  } catch (err) {
    console.error("\n❌ Migration failed:");
    console.error(`   ${err.message}\n`);

    console.log("📝 Alternative: Run in Supabase Dashboard:");
    console.log("   1. Go to https://app.supabase.com");
    console.log("   2. SQL Editor → New Query");
    console.log("   3. Paste SQL from: supabase/migrations/20260317000000_create_user_preferences_table.sql");
    console.log("   4. Click Run\n");

    process.exit(1);
  }
})();
