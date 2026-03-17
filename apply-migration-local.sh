#!/bin/bash

# Migration application script for local machine
# Run this on your local machine to apply the user_preferences migration

set -e

echo "🔧 Universal Table Sorting - Migration Setup"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_PASSWORD is set
if [ -z "$DATABASE_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_PASSWORD not set${NC}"
    echo ""
    echo "Three ways to apply the migration:"
    echo ""
    echo "1️⃣  Option A: Supabase Dashboard (Recommended)"
    echo "   - Open: https://app.supabase.com"
    echo "   - Select project: cobra-command-center"
    echo "   - Go to SQL Editor"
    echo "   - Click: + New Query"
    echo "   - Copy SQL from: supabase/migrations/20260317000000_create_user_preferences_table.sql"
    echo "   - Click: Run"
    echo ""
    echo "2️⃣  Option B: Via psql (requires psql installed)"
    echo "   - Set DATABASE_PASSWORD environment variable"
    echo "   - Run this script again"
    echo ""
    echo "3️⃣  Option C: Via Node.js"
    echo "   - npm install"
    echo "   - export DATABASE_PASSWORD=<password>"
    echo "   - npx tsx apply-migration.ts"
    echo ""
    exit 0
fi

# Database connection info
DB_HOST="db.ljpdwezgahrrffnwajho.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD="$DATABASE_PASSWORD"

echo -e "${BLUE}📊 Connecting to Supabase...${NC}"
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo ""

# Apply migration
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "supabase/migrations/20260317000000_create_user_preferences_table.sql"

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    echo ""
    echo "Created:"
    echo "  ✅ user_preferences table"
    echo "  ✅ RLS policies (4 policies)"
    echo "  ✅ Index on (user_id, page_name)"
    echo "  ✅ Auto-update trigger"
    echo ""
    echo "Next steps:"
    echo "  1. npm run build"
    echo "  2. Deploy to production"
    echo "  3. Test: Click column headers to sort"
    echo "  4. Refresh page → sort should persist"
else
    echo ""
    echo -e "${YELLOW}⚠️  Migration may have encountered an issue${NC}"
    echo "Check the output above for details"
    exit 1
fi
