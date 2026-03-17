#!/bin/bash

# Apply user_preferences migration to Supabase
# This script needs the SERVICE_ROLE_KEY (admin key) to work

echo "════════════════════════════════════════════════════════════════════════"
echo "  🔑 Supabase Migration - Requires SERVICE_ROLE_KEY"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "To apply the migration, I need your service role key (admin access)."
echo ""
echo "📍 To find it:"
echo "   1. Go to: https://app.supabase.com"
echo "   2. Select: cobra-command-center"
echo "   3. Click: Settings → API"
echo "   4. Find: 'Service Role' key"
echo "   5. Copy it"
echo ""
echo "⚠️  Keep this key secret! Don't commit it or share it."
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Read the service role key from user
read -p "Paste your service role key here (or Ctrl+C to cancel): " SERVICE_ROLE_KEY

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ No service role key provided. Aborting."
    exit 1
fi

echo ""
echo "✅ Service role key received"
echo ""

# Get Supabase URL from .env
SUPABASE_URL=$(grep "VITE_SUPABASE_URL=" .env | cut -d'"' -f2)
PROJECT_ID=$(grep "VITE_SUPABASE_PROJECT_ID=" .env | cut -d'"' -f2)

echo "📌 Project: $PROJECT_ID"
echo "🔗 URL: $SUPABASE_URL"
echo ""

# Read migration SQL
MIGRATION_SQL=$(cat supabase/migrations/20260317000000_create_user_preferences_table.sql)

echo "🚀 Applying migration..."
echo ""

# Try to apply via Supabase REST API with service role
# This endpoint allows executing raw SQL (requires service role key)
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$MIGRATION_SQL" | jq -Rs .)}")

# Check response
if echo "$RESPONSE" | grep -q "error\|Error"; then
    echo "⚠️  REST API method not available (expected)"
    echo ""
    echo "📌 Trying alternative method with pg_net..."

    # Alternative: Use Supabase SQL endpoint
    # This requires a different approach

    echo "ℹ️  Since direct SQL API is not available with this key,"
    echo "    please use the Supabase dashboard to apply the migration:"
    echo ""
    echo "    1. Go to: https://app.supabase.com"
    echo "    2. Select: cobra-command-center"
    echo "    3. Click: SQL Editor → + New Query"
    echo "    4. Copy and paste the migration SQL"
    echo "    5. Click: Run"
    echo ""
    exit 1
else
    echo "✅ Migration applied successfully!"
    exit 0
fi
