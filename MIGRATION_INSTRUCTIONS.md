# Migration Instructions

## Project Update: New Supabase Project

**Old Project ID:** `pjruyvhtivbeikxrnipg` ❌
**New Project ID:** `ljpdwezgahrrffnwajho` ✅

All references have been updated in the codebase.

---

## Applying Migrations

### Migration: `20260317000000_create_user_preferences_table.sql`

This migration creates the `user_preferences` table to persist user's table sorting and filtering preferences.

#### **Option 1: Via Supabase Dashboard (Easiest)**

1. Go to [Supabase Console](https://app.supabase.com)
2. Select project: **cobra-command-center** (ljpdwezgahrrffnwajho)
3. Navigate to **SQL Editor** → **+ New Query**
4. Copy and paste the SQL below
5. Click **Run**

<details>
<summary>Click to reveal SQL</summary>

```sql
-- Create user_preferences table for persisting table sort and filter preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_name text NOT NULL,
  sort_field text,
  sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
  filters jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Ensure one preference per user per page
  UNIQUE(user_id, page_name)
);

-- Create index for fast lookups by user_id and page_name
CREATE INDEX idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own preferences
CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own preferences
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();
```

</details>

#### **Option 2: Via Supabase CLI (with proper network access)**

```bash
# Load environment variables
source .env.local

# Apply all pending migrations
npx supabase db push --db-url "$DATABASE_URL"
```

#### **Option 3: Direct psql Connection**

```bash
# Load environment variables
source .env.local

# Apply migration directly
psql "$DATABASE_URL" -f supabase/migrations/20260317000000_create_user_preferences_table.sql
```

---

## Environment Variables

Credentials are stored in `.env.local` (NOT committed to git):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:password@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres
DATABASE_PASSWORD=eKKrBzsf9xKoCyET
```

---

## Verification

After applying the migration, verify in Supabase console:

```sql
SELECT * FROM pg_tables WHERE tablename = 'user_preferences';
```

Should return 1 row.

---

## What Changed

### Updated Files
- ✅ `.env` - Project ID and URL updated
- ✅ `supabase/config.toml` - Project reference updated
- ✅ `src/contexts/AppContext.tsx` - Fallback URL updated
- ✅ `mcp-server/src/supabase.ts` - Fallback URL updated

### Created Files
- ✅ `.env.local` - Service role key and database credentials
- ✅ `apply-migration-direct.mjs` - Node.js migration script
- ✅ `apply-migration-with-service-key.sh` - Shell migration script
- ✅ `MIGRATION_INSTRUCTIONS.md` - This file

---

## Support

If migrations fail or you need help, check:
1. Supabase console for error messages
2. Network connectivity to database
3. Service role key has admin permissions
4. Database user has CREATE TABLE permissions
