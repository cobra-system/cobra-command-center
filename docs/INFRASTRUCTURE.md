# Infrastructure & Disaster Recovery

## Architecture Overview

COBRA Command Center runs on:
- **Frontend**: React (Vite) deployed via Vercel
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **Database**: Supabase-managed PostgreSQL (project `ljpdwezgahrrffnwajho`)

## Environment Variables

See `.env.example` for all required variables.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase API endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Supabase anon key (public) |
| `VITE_SUPABASE_PROJECT_ID` | Client | Project identifier |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations in Edge Functions |
| `DATABASE_PASSWORD` | Server only | Direct DB access |
| `POSTGRES_URL` | Server only | PostgreSQL connection string |
| `VITE_SENTRY_DSN` | Client (optional) | Error tracking |
| `DHL_API_KEY` | Server only (Supabase secret) | DHL Tracking API — create at developer.dhl.com |
| `RESEND_API_KEY` | Server only (Supabase secret) | Resend email service — create at resend.com |
| `RESEND_FROM_EMAIL` | Server only (Supabase secret) | Sender address (must be verified domain in Resend) |
| `CRON_SECRET` | Server + GitHub secret | Static bearer token for cron-triggered Edge Functions |

**Security notes:**
- Never commit `.env` — it is in `.gitignore`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — use only in Edge Functions
- Rotate keys via Supabase Dashboard > Settings > API

## Database Backups

### Automatic Backups (Supabase-managed)
- **Pro plan**: Daily automatic backups, 7-day retention
- **Point-in-time recovery (PITR)**: Available on Pro+ plans
- Backups are taken automatically — no configuration needed

### Manual Backup
```bash
# Export full database
pg_dump "$POSTGRES_URL" > backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump "$POSTGRES_URL" -t products -t orders > partial_backup.sql
```

### Restore from Backup
```bash
# Restore to a fresh database
psql "$POSTGRES_URL" < backup_20260407.sql

# Or use Supabase Dashboard > Database > Backups > Restore
```

## Database Migrations

56 migrations in `supabase/migrations/`. Applied automatically via CI (`.github/workflows/supabase-migration.yml`).

### Applying Migrations
```bash
# Via Supabase CLI
supabase db push

# Via CI (automatic on push to main/develop)
```

### Rollback Procedure
Supabase migrations are forward-only. To rollback:

1. Create a new migration that reverses the changes:
   ```bash
   supabase migration new rollback_description
   ```
2. Write the reverse SQL (DROP, ALTER, etc.)
3. Push the new migration

**Critical:** Always test rollback migrations on a staging project first.

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:
- **profiles**: Users can read all profiles, update only their own
- **audit_log**: Only managers can read; writes via service role only
- **orders, products, tasks, suppliers**: Authenticated users can read/write (role-based filtering done at app level via permissions system)

## Edge Functions

17 Edge Functions deployed to Supabase:

| Function | Purpose | Auth | Rate Limit |
|----------|---------|------|------------|
| `create-employee` | Create new users | MANAGER | 5/min |
| `manage-employee` | Update/delete users | MANAGER | 20/min |
| `generate-recurring-tasks` | Create task instances | Service role | — |
| `advance-overdue-tasks` | Move overdue tasks | Service role | — |
| `check-compliance` | Check expiring items | Service role | — |
| `health` | Database health check | None | — |
| `seed-data` | Seed demo data | MANAGER | — |
| `setup-external` | External system setup | MANAGER | — |
| `migrate-external` | External data migration | MANAGER | — |
| `fix-setup` | Fix setup issues | MANAGER | — |
| `fix-trigger` | Fix DB triggers | MANAGER | — |
| `debug-external` | Debug external connections | MANAGER | — |
| `track-shipment` | Refresh DHL tracking for an order | JWT (any role) | — |
| `notify-daily-digest` | Send daily email digest (overdue orders + upcoming payments) | CRON_SECRET | — |
| `sync-frisbee` | Sync פריזבי קרסו inspection data from Base44 (Bearer auth) | CRON_SECRET | — |
| `sync-lubinski` | Sync לובינסקי inspection data from Base44 (api_key auth) | CRON_SECRET | — |
| `reset-monthly-orders` | Reset fulfilled monthly order requests to pending on the 1st of each month | CRON_SECRET | — |

### Deploying Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Deploy a single function
supabase functions deploy health
```

### Rollback Edge Functions
```bash
# Redeploy previous version from git
git checkout <previous-commit> -- supabase/functions/<function-name>
supabase functions deploy <function-name>
```

## CI/CD Pipeline

### GitHub Actions Workflows
1. **`ci.yml`** — Lint, type-check, test, build (on PR and push)
2. **`supabase-migration.yml`** — Apply DB migrations and deploy Edge Functions — requires the `SUPABASE_DB_URL` secret (Supabase dashboard → Project → Connect → **Session pooler**, port 5432). The direct `db.<ref>.supabase.co` host is IPv6-only and GitHub runners are IPv4-only, so the pooler is the only way in; the workflow now fails loudly when it cannot connect instead of reporting success while applying nothing
3. **`advance-overdue-tasks.yml`** — Scheduled task advancement
4. **`daily-notifications.yml`** — Daily digest email (08:00 IL, weekdays) — requires `SUPABASE_URL` + `CRON_SECRET` GitHub secrets
5. **`monthly-reset.yml`** — Monthly order reset (05:00 IL, 1st of each month) — requires `SUPABASE_URL` + `CRON_SECRET` GitHub secrets
6. **`changelog.yml`** — Changelog generation

### Vercel Deployment
- Automatic preview deployments on PRs
- Production deployment on merge to `main`
- Environment variables configured in Vercel Dashboard

## Incident Response

### Database Issues
1. Check health endpoint: `GET /functions/v1/health`
2. Check Supabase Dashboard > Database > Health
3. Review `audit_log` for recent operations
4. If corrupted: restore from latest backup via Dashboard

### Auth Issues
1. Check Supabase Dashboard > Authentication > Users
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is valid
3. Check rate limiting in Edge Functions (`create-employee`, `manage-employee`)

### Frontend Down
1. Check Vercel Dashboard for deployment status
2. Verify environment variables are set correctly
3. Check Sentry for error reports (if configured)
4. Rollback: redeploy previous Vercel deployment via Dashboard

### Edge Function Failures
1. Check Supabase Dashboard > Edge Functions > Logs
2. Verify CORS configuration (`_shared/cors.ts`)
3. Check function-specific rate limits
4. Redeploy from last known good commit

## Monitoring

- **Error tracking**: Sentry (optional, via `VITE_SENTRY_DSN`)
- **Structured logging**: `src/lib/logger.ts` with level-based output
- **Activity logging**: `audit_log` table tracks sensitive operations
- **Health check**: `/functions/v1/health` endpoint for uptime monitoring
