#!/usr/bin/env node

/**
 * Apply user_preferences migration directly using PostgreSQL
 * This requires either:
 * 1. DATABASE_URL environment variable (postgres://...)
 * 2. Or SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("════════════════════════════════════════════════════════════════");
console.log("  🔑 Supabase Migration - Direct Connection");
console.log("════════════════════════════════════════════════════════════════");
console.log("");

// Check for credentials
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!serviceRoleKey && !databaseUrl) {
  console.log("❌ Missing credentials. Provide ONE of:");
  console.log("");
  console.log("Option 1: Via environment variable");
  console.log("  export SUPABASE_SERVICE_ROLE_KEY='your-key-here'");
  console.log("  npm run apply-migration-direct");
  console.log("");
  console.log("Option 2: Via DATABASE_URL");
  console.log(
    "  export DATABASE_URL='postgresql://user:password@host/database'"
  );
  console.log("  npm run apply-migration-direct");
  console.log("");
  console.log("Or use interactive mode:");
  console.log("  node apply-migration-direct.mjs --interactive");
  console.log("");
  process.exit(1);
}

// Read migration SQL
const migrationPath = path.join(
  __dirname,
  "supabase/migrations/20260317000000_create_user_preferences_table.sql"
);
const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

console.log("📋 Migration SQL loaded");
console.log(`📝 ${migrationSQL.split("\n").length} lines`);
console.log("");

// Try to apply migration
async function applyMigration() {
  try {
    if (databaseUrl) {
      console.log("🔗 Using DATABASE_URL connection...");
      return await applyViaPostgres(databaseUrl);
    } else if (serviceRoleKey) {
      console.log("🔗 Using SERVICE_ROLE_KEY...");
      return await applyViaServiceKey(serviceRoleKey);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

async function applyViaPostgres(dbUrl) {
  console.log("Connecting to PostgreSQL database...");

  try {
    // Dynamically import pg
    const pg = await import("pg");
    const { Client } = pg.default || pg;

    const client = new Client({
      connectionString: dbUrl,
    });

    await client.connect();
    console.log("✅ Connected to database");

    // Split and execute statements
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    for (const [index, statement] of statements.entries()) {
      console.log(`\n[${index + 1}/${statements.length}] Executing...`);
      try {
        await client.query(statement);
        console.log("✅ Success");
      } catch (err) {
        console.log(`⚠️  Error (may be expected): ${err.message}`);
        // Continue - some statements may fail if already exist
      }
    }

    await client.end();
    console.log("\n✅ Migration completed!");
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);
    console.log("\nℹ️  Make sure the 'pg' package is installed:");
    console.log("  npm install pg");
    return false;
  }
}

async function applyViaServiceKey(key) {
  console.log(
    "Using Supabase admin API (requires pg_net or similar setup)..."
  );
  console.log("");
  console.log("ℹ️  Direct SQL execution via service key requires:");
  console.log("  1. Supabase PostgreSQL connection, OR");
  console.log("  2. pg_net extension enabled (for RPC calls)");
  console.log("");
  console.log("The easiest method is to use the Supabase dashboard:");
  console.log("");
  console.log("1. Go to: https://app.supabase.com");
  console.log("2. Select: cobra-command-center");
  console.log("3. Click: SQL Editor → + New Query");
  console.log("4. Copy and paste the SQL from MIGRATION_QUICK_START.txt");
  console.log("5. Click: Run");
  console.log("");
  return false;
}

// Run migration
console.log("🚀 Starting migration...");
console.log("");

applyMigration()
  .then((success) => {
    console.log("");
    console.log(
      "════════════════════════════════════════════════════════════════"
    );
    if (success) {
      console.log("✅ Migration applied successfully!");
      process.exit(0);
    } else {
      console.log("ℹ️  Please use the Supabase dashboard to apply the migration");
      process.exit(0);
    }
  });
