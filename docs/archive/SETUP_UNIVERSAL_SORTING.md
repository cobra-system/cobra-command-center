# Universal Table Sorting - Setup Guide

This guide walks you through applying the database migration and testing the new sorting feature.

## Step 1: Apply Database Migration

The migration creates the `user_preferences` table for persisting sort and filter state. You have two options:

### Option A: Via Supabase Dashboard (Easiest)

1. Go to https://app.supabase.com
2. Select your project: `cobra-command-center`
3. Click **SQL Editor** in the left sidebar
4. Click **+ New Query**
5. Copy and paste the entire SQL from below
6. Click **Run**

#### SQL Migration:
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

### Option B: Via Supabase CLI

```bash
supabase db push
```

This automatically applies all pending migrations in `supabase/migrations/`.

---

## Step 2: Test the Implementation

### Test 1: Basic Sorting
1. Go to **Products** page
2. Click the column headers (Name, SKU, Type, etc.)
3. Verify:
   - First click: Sort ascending (⬆️ arrow visible)
   - Second click: Sort descending (⬇️ arrow visible)
   - Third click: Clear sort (⬌ arrow, faded)

### Test 2: Persistence (Most Important!)
1. Go to **Products** page
2. Click to sort by **Name** (ascending)
3. **Refresh the page** (F5 or Cmd+R)
4. ✅ **EXPECTED**: Table is still sorted by Name ascending
5. Go to **Suppliers** page
6. ✅ **EXPECTED**: Suppliers page shows its own sort (not Products' sort)
7. Go back to **Products**
8. ✅ **EXPECTED**: Products are still sorted by Name ascending

### Test 3: Logout/Login Persistence
1. While on **Products** page, sort by **Stock Qty** (descending)
2. **Logout** (click your user menu → Logout)
3. **Login** again with your credentials
4. Go to **Products** page
5. ✅ **EXPECTED**: Still sorted by Stock Qty descending

### Test 4: Filter + Sort Persistence
1. Go to **ProductsPage**
2. Select a **Category** filter
3. Click to sort by **Supplier**
4. **Refresh the page**
5. ✅ **EXPECTED**: Both filter AND sort are remembered

### Test 5: All Pages Sortable
Test that clicking column headers works on:
- ✅ ProductsPage (8 columns)
- ✅ SuppliersPage (5 columns)
- ✅ DocumentsTable / DocumentsPage
- ✅ PaymentsTable / DocumentsPage (Payments tab)
- ✅ ReorderPage (all 8 columns, including new sorting)
- ✅ TeamPage (Name, Role columns)
- ✅ IssuesPage (Date, Product, Reporter, Severity, Status columns)
- ✅ InventoryPage (Name, SKU, Total buttons)

---

## Step 3: Verify Database Table

After running the migration, verify the table was created:

### Via Supabase Dashboard:
1. Go to https://app.supabase.com
2. Select your project
3. Click **Table Editor** in left sidebar
4. Look for **user_preferences** table in the list
5. ✅ You should see: `id`, `user_id`, `page_name`, `sort_field`, `sort_dir`, `filters`, `created_at`, `updated_at`

### Via SQL Query:
Run this in SQL Editor:
```sql
SELECT * FROM public.user_preferences LIMIT 5;
```

After sorting a page, you should see rows appear in this table.

---

## How It Works

### When User Sorts a Column:
1. Hook saves sort state to `user_preferences` table in Supabase
2. Also saves to localStorage as fallback
3. Table updates immediately (instant feedback)

### When User Navigates Away:
- Sort preference stays in database
- Can logout/login and sort is restored
- Can switch browsers on same account and get same sort (if DB synced)

### When User Returns to Page:
1. Hook loads sort preference from database
2. If no database access, uses localStorage
3. If neither exists, uses default sort (usually alphabetical)

### Fallback (Offline Mode):
- If database is unreachable, localStorage stores sort locally
- When database comes back online, data syncs
- Works seamlessly for offline-capable apps

---

## Troubleshooting

### Problem: Sorting doesn't persist after refresh
**Solution**: Make sure the migration has been applied. Check Supabase dashboard → Table Editor for `user_preferences` table.

### Problem: Getting permission denied errors
**Solution**: The RLS (Row Level Security) policies might not be applied. Re-run the full SQL migration in Step 1.

### Problem: Still get "table does not exist" errors
**Solution**:
1. Check Supabase dashboard for the table
2. If missing, run the SQL migration again
3. The app has localStorage fallback, so sorting will still work (but not persist across logout)

### Problem: Sorting works but doesn't persist after logout
**Solution**:
- Verify you're logged in with the same account
- Check browser console for error messages
- Fallback to localStorage works automatically

---

## Architecture

- **Database**: `user_preferences` table in Supabase (PostgreSQL)
- **Persistence**: Per-user, per-page sort + filter settings
- **RLS**: Each user can only see/modify their own preferences
- **Hook**: `useTablePreferences(pageName, defaults)`
- **Fallback**: localStorage if database unavailable
- **Storage**: JSONB for flexible filter storage

---

## Next Features (Future)

- [ ] Preset sort configurations (save multiple sort views)
- [ ] Admin dashboard to see user preferences
- [ ] Import/export user preferences
- [ ] System-wide default sort overrides
- [ ] Multi-device sync status indicator

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify migration was applied (see Step 3)
3. Test with localStorage (check DevTools → Application → Local Storage)
4. Check Supabase logs for any query errors
