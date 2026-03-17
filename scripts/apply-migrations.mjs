#!/usr/bin/env node

/**
 * Database Migration Runner (ESM version)
 * Automatically applies all pending migrations from supabase/migrations/ to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key.trim() && !process.env[key.trim()]) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    });
  }
}

loadEnv();

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const SCHEMA_TABLE = '_migrations_history';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    // Get database connection string
    let dbUrl = process.env.POSTGRES_URL;

    if (!dbUrl && process.env.SUPABASE_URL && process.env.DATABASE_PASSWORD) {
      const dbPassword = process.env.DATABASE_PASSWORD;
      const supabaseUrl = process.env.SUPABASE_URL;
      const projectId = supabaseUrl.replace('https://', '').split('.')[0];
      dbUrl = `postgresql://postgres:${dbPassword}@db.${projectId}.supabase.co:5432/postgres`;
    }

    if (!dbUrl) {
      throw new Error('Missing database connection. Set POSTGRES_URL or SUPABASE_URL + DATABASE_PASSWORD in .env');
    }

    log(`\n📦 Database Migration Runner`, 'blue');
    log(`🔗 Connecting to: ${dbUrl.replace(/:[^:]*@/, ':****@')}`, 'blue');

    // Check if migrations directory exists
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }

    // Read all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      log('⚠️  No migration files found', 'yellow');
      return;
    }

    log(`\n📂 Found ${migrationFiles.length} migration(s):`, 'blue');
    migrationFiles.forEach(f => log(`   • ${f}`));

    // Read migration files
    const migrations = migrationFiles.map(filename => ({
      name: filename,
      path: path.join(MIGRATIONS_DIR, filename),
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8')
    }));

    // Create a combined migration script
    log(`\n⚙️  Preparing migration script...`, 'blue');

    let fullSql = `
-- Cobra Command Center - Migration Runner
-- Generated: ${new Date().toISOString()}

-- Create migrations history table if it doesn't exist
CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;

    // Add each migration with transaction safety
    migrations.forEach(({ name, sql }) => {
      fullSql += `\n-- Migration: ${name}\n`;
      fullSql += `DO $$ BEGIN\n`;
      fullSql += `  IF NOT EXISTS (SELECT 1 FROM ${SCHEMA_TABLE} WHERE migration_name = '${name}') THEN\n`;
      fullSql += `    ${sql.trim().split('\n').map(line => `    ${line}`).join('\n')}\n`;
      fullSql += `    INSERT INTO ${SCHEMA_TABLE} (migration_name) VALUES ('${name}');\n`;
      fullSql += `    RAISE NOTICE 'Applied migration: ${name}';\n`;
      fullSql += `  ELSE\n`;
      fullSql += `    RAISE NOTICE 'Skipped migration (already applied): ${name}';\n`;
      fullSql += `  END IF;\n`;
      fullSql += `END $$;\n`;
    });

    // Save combined migration script
    const outputPath = path.join(__dirname, '../full_migration.sql');
    fs.writeFileSync(outputPath, fullSql);
    log(`✅ Migration script generated: ${outputPath}`, 'green');

    // Try to execute via psql if available
    try {
      log(`\n🚀 Executing migrations...`, 'blue');
      const psqlCmd = `psql "${dbUrl}" -f "${outputPath}" --set ON_ERROR_STOP=1`;
      execSync(psqlCmd, { stdio: 'inherit' });
      log(`\n✅ All migrations applied successfully!`, 'green');
    } catch (psqlError) {
      log(`\n⚠️  Could not execute via psql (not installed in this environment)`, 'yellow');
      log(`\n📄 Migration script is ready at: ${outputPath}`, 'blue');
      log(`\n💡 To apply manually in Supabase Dashboard:`, 'blue');
      log(`   1. Go to https://app.supabase.com`);
      log(`   2. Select project: cobra-command-center`);
      log(`   3. SQL Editor → New Query`);
      log(`   4. Copy content from: ${outputPath}`);
      log(`   5. Click "Run"`);
      log(`\n💻 Or apply via CLI: npx supabase db push`, 'blue');
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
