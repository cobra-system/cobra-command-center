#!/bin/bash

# Migration Runner for user_preferences table
#
# Usage: ./apply-migration.sh
# or:    bash apply-migration.sh
#
# Requires environment variables:
# - DATABASE_URL (from .env.local)
# - or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

set -e

echo "🔄 Cobra Command Center - Apply Migration"
echo "=========================================="

# Load environment variables
if [ -f .env.local ]; then
  echo "📂 Loading credentials from .env.local..."
  source .env.local
else
  echo "❌ Error: .env.local not found"
  echo "   Make sure you have the credentials file in the project root"
  exit 1
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not set"
  echo "   Check .env.local file"
  exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo "❌ Error: psql not found"
  echo "   Install PostgreSQL client tools"
  echo "   - Ubuntu/Debian: sudo apt install postgresql-client"
  echo "   - macOS: brew install postgresql"
  echo "   - Windows: https://www.postgresql.org/download/windows/"
  exit 1
fi

# Verify migration file exists
MIGRATION_FILE="supabase/migrations/20260317000000_create_user_preferences_table.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "✅ Prerequisites met"
echo ""
echo "📝 Migration Details:"
echo "   File: $MIGRATION_FILE"
echo "   Project: ljpdwezgahrrffnwajho"
echo "   Table: user_preferences"
echo ""
echo "⚠️  This will modify the database. Proceed? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "🚀 Applying migration..."
echo ""

# Run psql with the migration file
if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
  echo ""
  echo "✨ Migration completed successfully!"
  echo ""
  echo "📊 Verification:"
  psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename = 'user_preferences';"
  echo ""
  echo "✅ All done! The user_preferences table is now ready."
else
  echo ""
  echo "❌ Migration failed"
  echo "   Check the error message above"
  exit 1
fi
