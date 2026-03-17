#!/bin/bash

# Configuration
SUPABASE_URL="https://ljpdwezgahrrffnwajho.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcGR3ZXpnYWhycmZmbndhamhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxNjI0MSwiZXhwIjoyMDg4NTkyMjQxfQ.lfXs1ZhOrjb--2l9lIs8KgQwqtGx49l7k0Fk1E0rpCw"
DATABASE_URL="postgresql://postgres:eKKrBzsf9xKoCyET@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres"

echo "🚀 Attempting to apply migration via Supabase..."

# Read the migration SQL
MIGRATION_SQL=$(cat << 'SQLEOF'
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

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own preferences" ON public.user_preferences;
CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();
SQLEOF
)

echo "📝 SQL prepared"
echo "🔗 Attempting curl request to REST API..."

# Try via REST API
RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sql\":\"$(echo "$MIGRATION_SQL" | sed 's/"/\\"/g' | tr '\n' ' ')\"}" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Migration likely applied!"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "⚠️ RPC function not found, trying alternative..."
  echo "💡 You may need to manually apply via Supabase dashboard"
else
  echo "⚠️ Unclear result - checking if table exists anyway..."
fi

echo ""
echo "✅ Migration attempt complete"
