# Database Migrations Guide

## Overview
This project uses PostgreSQL migrations managed through Supabase. All migration files are stored in `supabase/migrations/`.

**Total migrations: 132** (last: `20260517000001_create_division_product_items.sql`)

## How to Apply Migrations

### Option 1: Using the Migration Runner Script (Recommended for Claude Code)
```bash
npm run migrate
```

This script will:
1. ✅ Read all migration files from `supabase/migrations/`
2. ✅ Generate a combined migration script (`full_migration.sql`)
3. ✅ Try to apply it via `psql` (if installed)
4. ✅ If `psql` is not available, provide instructions for manual application

### Option 2: GitHub Actions (Automatic on Push)
Migrations are automatically applied when code is pushed to the repository via the GitHub Actions workflow (`.github/workflows/supabase-migration.yml`).

**Setup Required:**
Add these secrets to your GitHub repository:
- `SUPABASE_SERVICE_ROLE_KEY` - Service role JWT key
- `DATABASE_PASSWORD` - PostgreSQL password

### Option 3: Supabase Dashboard (Manual)
1. Go to https://app.supabase.com
2. Select project: `cobra-command-center`
3. Navigate to **SQL Editor** → **New Query**
4. Copy the entire content from `full_migration.sql`
5. Click **Run**

### Option 4: Supabase CLI
```bash
# Link to Supabase project
npx supabase link --project-ref ljpdwezgahrrffnwajho

# Push all pending migrations
npx supabase db push
```

## Migration Tracking
All applied migrations are tracked in the `_migrations_history` table:
```sql
SELECT * FROM _migrations_history;
```

This ensures:
- ✅ No migration is applied twice
- ✅ Easy rollback of changes (manually revert in Supabase)
- ✅ Clear audit trail of database changes

## Adding New Migrations
When you create a new migration in Supabase:

1. The migration file is automatically saved in `supabase/migrations/`
2. Run `npm run migrate` to apply it
3. Commit the migration file to git
4. Push to GitHub (GitHub Actions will apply it automatically)

## Troubleshooting

### "psql: not found"
This is expected in environments without PostgreSQL installed (like Claude Code's sandbox). The migration runner will generate the SQL and provide instructions for manual application.

### "Can't connect to Supabase"
Verify credentials in `.env`:
```
POSTGRES_URL=postgresql://postgres:PASSWORD@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres
DATABASE_PASSWORD=YOUR_PASSWORD
```

### Migration Failed
1. Check the error message in logs
2. Manually review the SQL in `full_migration.sql`
3. Fix the SQL and reapply via Supabase Dashboard

## Environment Variables
Required in `.env`:
```
VITE_SUPABASE_URL=https://ljpdwezgahrrffnwajho.supabase.co
VITE_SUPABASE_PROJECT_ID=ljpdwezgahrrffnwajho
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key

# For migrations (optional, auto-generated if missing)
POSTGRES_URL=postgresql://postgres:password@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres
DATABASE_PASSWORD=your_password
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## CI/CD Integration
GitHub Actions automatically:
- ✅ Runs migrations on every push to `main`, `develop`, or `claude/**` branches
- ✅ Tracks migration history to prevent duplicates
- ✅ Notifies of any failures via comments on PRs

## References
- [Supabase Migrations Documentation](https://supabase.com/docs/guides/database/managing-migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
