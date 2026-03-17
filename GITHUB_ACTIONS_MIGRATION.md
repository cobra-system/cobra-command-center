# Automatic Migration via GitHub Actions

This GitHub Actions workflow will automatically apply database migrations to your Supabase project.

## Setup (One-time)

### Step 1: Add Database URL Secret

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SUPABASE_DATABASE_URL`
5. Value: `postgresql://postgres:eKKrBzsf9xKoCyET@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres`
6. Click **Add secret**

### Step 2: Trigger the Migration

**Option A: Manual Trigger (Recommended first time)**
1. Go to **Actions** tab
2. Select **Apply Database Migration** workflow
3. Click **Run workflow**
4. Watch the logs

**Option B: Automatic on Merge**
- The workflow will run automatically when you merge a PR that includes changes to `supabase/migrations/`

**Option C: Automatic on Push to main**
- The workflow will run automatically when you push to main

## Monitoring

1. Go to **Actions** tab
2. Click the latest **Apply Database Migration** run
3. Check the logs for:
   - ✅ Connected to database
   - ✅ Migration file applied
   - ✅ Table verification

## What it Does

1. Installs dependencies
2. Connects to your Supabase database
3. Executes all `.sql` files in `supabase/migrations/` directory
4. Verifies the `user_preferences` table was created
5. Reports success or failure

## Troubleshooting

**"Authentication failed"**
- Check that `SUPABASE_DATABASE_URL` secret is set correctly
- Verify the password in the connection string

**"Connection timeout"**
- Ensure your Supabase project is active
- Check network connectivity

**"Migration already exists"**
- The SQL uses `CREATE TABLE IF NOT EXISTS` - safe to run multiple times
- Policies use `DROP POLICY IF EXISTS` before creating

## Next Steps

1. Add the secret to your repository (see Step 1 above)
2. Go to **Actions** and trigger the workflow
3. Verify the table was created
4. Done! Your app now has persistent table preferences
