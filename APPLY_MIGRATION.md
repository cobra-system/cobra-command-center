# 🔧 Universal Table Sorting - Migration Setup

## Overview

The universal table sorting feature is complete and ready to use. The **only remaining step** is to apply a single database migration that creates the `user_preferences` table for persistent storage.

The app will work with `localStorage` fallback immediately, but to enable cross-device sync and persistent storage after logout/login, you need to apply this migration.

---

## Three Ways to Apply the Migration

### 🟢 **Option 1: Supabase Dashboard (Recommended - Easiest)**

**No coding or special tools required**

1. Open: https://app.supabase.com
2. Select project: **cobra-command-center**
3. Go to **SQL Editor** (left sidebar)
4. Click **+ New Query**
5. Copy the SQL from one of these files:
   - `supabase/migrations/20260317000000_create_user_preferences_table.sql`
   - OR the full SQL below (see "SQL to Run" section)
6. Paste into the query box
7. Click **Run**
8. Done! ✅

**Expected output:**
```
CREATE TABLE
CREATE INDEX
ALTER TABLE
CREATE POLICY (4x)
CREATE FUNCTION
CREATE TRIGGER
```

---

### 🔵 **Option 2: Using Bash Script (Linux/Mac)**

**Requirements:** `psql` command installed

```bash
# From the project root directory:
export DATABASE_PASSWORD="eKKrBzsf9xKoCyET"
bash apply-migration-local.sh
```

**Or shorter version:**
```bash
DATABASE_PASSWORD="eKKrBzsf9xKoCyET" psql \
  -h db.ljpdwezgahrrffnwajho.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f supabase/migrations/20260317000000_create_user_preferences_table.sql
```

---

### 🟣 **Option 3: Using Node.js (Node 16+)**

**Requirements:** Node.js installed, project dependencies

```bash
# Install dependencies (if not already done)
npm install

# Run migration script
npx tsx apply-migration.ts
```

**Or manually:**
```bash
node -e "
const fs = require('fs');
const sql = fs.readFileSync('supabase/migrations/20260317000000_create_user_preferences_table.sql', 'utf8');
console.log(sql);
"
```

Then copy the SQL and paste into Supabase Dashboard SQL Editor.

---

## SQL to Run

If you want to apply the migration directly, here's the SQL:

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

---

## After Migration Applied ✅

Once you've applied the migration, test the feature:

### 1. **Build the project**
```bash
npm run build
```

### 2. **Test in development**
```bash
npm run dev
```

### 3. **Test the sorting**
- Go to **Products page**
- Click any column header → table sorts
- **Refresh the page** (F5) → **sorting persists** ✅
- Go to **Suppliers page** → **different sort state** ✅
- Go back to **Products** → **original sort restored** ✅
- **Logout → Login** → **sort still there** ✅

### 4. **Deploy to production**
```bash
npm run build
# Deploy using your platform (Vercel, etc.)
```

### 5. **Test in production**
Repeat step 3 in your production environment

---

## Verification

After applying the migration, you can verify it worked:

1. In Supabase Dashboard: **Table Editor** (left sidebar)
2. Look for **user_preferences** table in the list
3. Click it to see the structure with columns:
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key)
   - `page_name` (TEXT)
   - `sort_field` (TEXT)
   - `sort_dir` (TEXT)
   - `filters` (JSONB)
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

---

## Troubleshooting

### "Table already exists"
✅ This is fine! It means the migration was already applied. You can ignore this message.

### "Permission denied"
❌ Make sure you're using:
- Service Role Key (not anon key)
- Admin credentials
- Or use Supabase Dashboard which already has these permissions

### "CORS error" or "Network error"
❌ This might happen from local dev environment. Solutions:
1. Use **Option 1 (Supabase Dashboard)** - no network issues
2. Make sure you're on the right network
3. Check if firewall is blocking psql (port 5432)

### Migration didn't run but no error
✅ No problem! This usually means it already exists. Check the **Table Editor** for the `user_preferences` table.

---

## What This Migration Does

✅ Creates `user_preferences` table
- Stores sorting preference per user per page
- Stores filter preferences alongside sorting
- Auto-managed `updated_at` timestamp

✅ Row-Level Security (RLS)
- Users can ONLY see and modify their own preferences
- Complete data isolation
- No one can read other users' preferences

✅ Performance Index
- Fast lookups by (user_id, page_name)
- Automatic constraint to prevent duplicates

✅ Auto-cleanup
- Preferences deleted when user account deleted
- No orphaned data

---

## Features After Migration

Once applied, users can:

✅ **Click column headers to sort** on all pages
✅ **Sort persists when refreshing page**
✅ **Sort persists when logging out and back in**
✅ **Each page has independent sort state** (Products ≠ Suppliers)
✅ **Works on all devices** (syncs via database)
✅ **Works offline** (localStorage fallback)
✅ **Visual feedback** with sort icons (⬆️ ⬇️ ⬌)

---

## Pages with Universal Sorting

| Page | Sortable Columns | Status |
|------|------------------|--------|
| ProductsPage | 8 columns | ✅ Ready |
| SuppliersPage | 5 columns | ✅ Ready |
| DocumentsTable | 8 columns | ✅ Ready |
| PaymentsTable | 6 columns | ✅ Ready |
| ReorderPage | 8 columns | ✅ Ready |
| TeamPage | 2 columns | ✅ Ready |
| IssuesPage | 5 columns | ✅ Ready |
| InventoryPage | 3 columns | ✅ Ready |

---

## Technical Details

- **Hook:** `useTablePreferences(pageName, defaultPreferences)`
- **Database:** `user_preferences` table with RLS
- **Fallback:** localStorage when database unavailable
- **Locale:** Hebrew-aware string comparisons
- **Type Safety:** TypeScript strict mode

---

## Timeline

- **Apply migration:** 5 minutes (copy-paste in dashboard)
- **Build:** 2-3 minutes
- **Deploy:** Depends on your platform
- **Test:** 5 minutes
- **Total:** ~15 minutes from start to production

---

## Support

If you hit any issues:

1. Check the **Troubleshooting** section above
2. Verify the migration file exists: `supabase/migrations/20260317000000_create_user_preferences_table.sql`
3. Check Supabase Dashboard → **Table Editor** for `user_preferences` table
4. Review SQL output for errors

---

**You're all set! 🚀 Apply the migration and enjoy universal sorting across your entire system.**
