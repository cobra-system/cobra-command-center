# MCP Capabilities - Status

## New Tool Modules (DONE)

### 1. Analytics & Reports (`analytics.ts`)
- [x] `get_dashboard_kpis` - Total orders, revenue, pending payments, low-stock count
- [x] `get_sales_velocity` - Product sales velocity for reorder planning
- [x] `get_supplier_performance` - Lead time accuracy, issue rate per supplier
- [x] `get_inventory_valuation` - Stock value by center/product
- [x] `get_order_pipeline` - Orders grouped by status with totals
- [x] `get_overdue_items` - Overdue tasks, expired compliance, late orders in one call

### 2. Notifications & Alerts (`notifications.ts`)
- [x] `list_alerts` - Expiring compliance, low stock, overdue payments, late ETAs
- [x] `get_critical_alerts` - Only high-priority items requiring immediate attention
- [x] `check_reorder_needs` - Products below reorder point with suggested quantities

### 3. Bulk Operations (`bulk-ops.ts`)
- [x] `bulk_update_products` - Update prices/stock for multiple products
- [x] `bulk_update_order_status` - Change status for multiple orders at once
- [x] `bulk_complete_tasks` - Mark multiple task instances as done
- [x] `import_products_csv` - Parse and create products from structured data
- [x] `bulk_assign_tasks` - Assign multiple tasks to a team member

### 4. Cross-Module Search (`search.ts`)
- [x] `global_search` - Search across products, orders, suppliers, documents by keyword
- [x] `get_entity_timeline` - Full activity history for an order
- [x] `get_supplier_full_picture` - Orders + payments + documents + issues for a supplier
- [x] `get_product_full_picture` - Stock + orders + issues + compliance for a product

### 5. Financial Tools (`finance.ts`)
- [x] `get_payment_summary` - Total paid/pending/overdue by period
- [x] `get_supplier_balance` - Outstanding balance per supplier
- [x] `forecast_upcoming_payments` - Payments due in the next N days
- [x] `get_currency_exposure` - Breakdown by currency

### 6. Scheduled Reminders & Follow-ups (`reminders.ts`)
- [x] `create_follow_up` - Schedule a follow-up for an order/supplier/issue
- [x] `list_pending_follow_ups` - What needs attention today
- [x] `auto_generate_daily_report` - Build daily report from system data automatically

### 7. Learning Journal (`learning-journal.ts`)
- [x] `list_learning_entries` - List learning journal entries
- [x] `get_learning_entry` - Get a single entry
- [x] `create_learning_entry` - Create new entry
- [x] `update_learning_entry` - Update entry
- [x] `delete_learning_entry` - Delete entry

## Bug Fixes (DONE)

### Schema mismatches fixed
- [x] `tasks.ts` - Removed non-existent `category` column from `create_one_time_task`
- [x] `meetings.ts` - Removed query to non-existent `meeting_participants` table
- [x] `search.ts` - Removed non-existent `purchase_documents.supplier_name`
- [x] `finance.ts` - Removed non-existent `orders.currency`
- [x] `reminders.ts` - Removed `category` from tasks insert/select

### Hebrew value fixes
- [x] `notifications.ts` - Fixed English→Hebrew severity/status for product_issues
- [x] `analytics.ts` - Fixed English `closed`→Hebrew `נסגר` for issue status
- [x] `search.ts` - Fixed English `closed`→Hebrew `נסגר` for issue status
- [x] `reminders.ts` - Fixed English→Hebrew severity/status for issues

### Missing registrations fixed
- [x] `payments.ts` - Was never registered in `index.ts`
- [x] `workflows.ts` - Was never registered in `index.ts`

## Tools Added to Existing Modules (DONE)

### Inventory (`inventory.ts`)
- [x] `create_inventory_transfer` - Transfer stock between distribution centers
- [x] `list_inventory_transfers` - List transfers with center names
- [x] `list_center_contacts` - List contacts for a center
- [x] `create_center_contact` - Add contact to a center
- [x] `delete_center_contact` - Remove a center contact

### Products (`products.ts`)
- [x] `list_product_components` - List components of a product
- [x] `create_product_component` - Add component to a product
- [x] `update_product_component` - Update a component
- [x] `delete_product_component` - Delete a component
- [x] Expanded `create_product` with: description, sap_code, lead_time_days, supplier_origin, shipping, reorder_point

---

# COBRA Command Center - System Improvements TODO

> **Last reviewed:** 2026-04-07
> Priority legend: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
> Status: `[ ]` Not started | `[~]` Partial progress | `[x]` Done

---

## 1. Security 🔴

- [x] **Remove hardcoded secrets from source code** 🔴
  - `src/lib/supabase.ts` now reads from `import.meta.env` instead of hardcoded values
  - `.env` added to `.gitignore`
  - `.env.example` created with placeholder values

- [x] **Restrict CORS on Edge Functions** 🔴
  - Created `supabase/functions/_shared/cors.ts` with configurable `ALLOWED_ORIGIN` env var
  - All 12 Edge Functions updated to use shared CORS module

- [x] **Add rate limiting on auth endpoints** 🔴
  - Created `supabase/functions/_shared/rate-limit.ts` with in-memory sliding window
  - Rate limiting added to: `create-employee` (5/min), `manage-employee` (20/min)

- [x] **Strengthen password requirements** 🟠
  - Created `supabase/functions/_shared/password.ts` with validation utility
  - Minimum 10 characters, requires uppercase + lowercase + digit + special character
  - Applied to both `create-employee` and `manage-employee` password flows

- [x] **Implement audit trail for sensitive operations** 🟠
  - Created `audit_log` table via migration `20260331000000_add_audit_log_table.sql`
  - Columns: id, user_id, action, entity_type, entity_id, details (JSONB), ip_address, created_at
  - RLS policy: only managers can read; writes happen server-side via service role
  - Audit logging added to `create-employee` and `manage-employee` Edge Functions via shared `_shared/audit.ts`
  - Frontend audit logging via `src/lib/activityLogger.ts` in all domain contexts

- [x] **Harden auth token validation in Edge Functions** 🟠
  - Created `supabase/functions/_shared/auth.ts` with reusable `verifyAuth()` function
  - Validates token via `getUser()` (server-side expiration check) + role verification
  - `create-employee` and `manage-employee` refactored to use shared auth middleware

---

## 2. Database Improvements 🔴

- [x] **Add missing unique constraints** 🔴
  - `products.sku` already has UNIQUE constraint in schema
  - `profiles.id` is PRIMARY KEY (inherently unique)
  - `user_roles(user_id, role)` already has composite UNIQUE

- [x] **Add proper foreign key constraints with CASCADE/RESTRICT** 🟠
  - Migration `20260331000001_add_database_constraints.sql`
  - CASCADE: order_items→orders, product_components→products, supplier_contacts→suppliers, center_contacts→centers, center_inventory→centers, compliance_product_links, workflow_step_logs→instances
  - RESTRICT: orders→suppliers (prevent deleting suppliers with orders), order_items→products (prevent deleting products in orders)

- [x] **Add sensible default values** 🟡
  - Most defaults already existed: orders.status, tasks.status, products.stock_qty/incoming_qty
  - Added defaults for: supplier_payments.status, inventory_transfers.status, product_issues.status

- [x] **Add database-level validation constraints** 🟠
  - CHECK constraints added via migration for: products (stock_qty, incoming_qty, purchase_price, sale_price, lead_time_days), order_items (qty, unit_price), center_inventory (quantity, min_stock), inventory_transfers (quantity), supplier_payments (amount), supplier_price_quotes (unit_price)

---

## 3. Performance 🟠

- [x] **Add data fetch limits** 🟠
  - Added `.limit(500)` to products, orders, and tasks queries as safety net against unbounded growth
  - Full cursor-based pagination deferred — current data volumes don't justify the UI refactor

- [x] **Add database indexes on frequently queried columns** 🟠
  - Migration `20260402000000_add_performance_indexes.sql`
  - Indexes added: `orders(supplier_id)`, `orders(status)`, `tasks(assignee_id)`, `tasks(status)`, `product_components(product_id)`, `order_items(order_id)`, `compliance_items(expiry_date)`

- [x] **Fix N+1 query patterns** 🟠
  - Products: replaced 2 queries with single `.select("*, product_components(*)")` relational join
  - Suppliers: replaced 2 queries with single `.select("*, supplier_contacts(*)")` relational join

- [x] **Add lazy loading / code splitting for pages** 🟡
  - All 18 page imports converted to `React.lazy()` in `src/App.tsx`
  - Added `Suspense` wrapper with spinner fallback
  - Build now produces separate chunks per page (verified: OrdersPage 33KB, TasksPage 85KB, etc.)

- [x] **Optimize React Query caching defaults** 🟡
  - Configured QueryClient with `staleTime: 2min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `retry: 1`
  - All 6 domain context providers migrated from useState+useCallback to useQuery+useQueryClient
  - Optimistic updates use setQueryData; realtime subscriptions update query cache directly

---

## 4. Architecture & Code Quality 🟠

- [x] **Split monolithic AppContext into domain-specific contexts** 🟠
  - Split 924-line monolith into 7 domain contexts: AuthContext, ProductsContext, OrdersContext, TasksContext, GoalsContext, SuppliersContext, RolesContext
  - Shared types extracted to `src/contexts/types.ts`
  - AppContext refactored into ~120-line barrel with backward-compatible `useData()` and `useAuth()` re-exports
  - All 60+ consuming files continue working unchanged

- [x] **Break down large page components into sub-components** 🟡
  - OrdersPage (599→307 lines): extracted OrderFilters, OrderTable
  - SettingsPage (411→303 lines): extracted EmployeeFormDialog, RoleDefinitionManager, UserManagementTable
  - ProductDetailPage (461→217 lines): extracted ProductDetailsGrid, BOMTable, OrdersHistoryTable

- [x] **Improve TypeScript type safety** 🟡
  - Fixed `any` types in all new domain context files (ProductsContext, OrdersContext, TasksContext)
  - Fixed `sortUtils.ts` — `compareValues` params changed from `any` to `unknown`
  - _Remaining:_ ~100 `any` usages in page components (mostly Supabase response casting)

- [x] **Add global Error Boundary** 🟠
  - Created `src/components/ErrorBoundary.tsx` with Hebrew fallback UI ("משהו השתבש")
  - "נסה שוב" (retry) and "חזרה לדף הראשי" (go home) actions
  - Wraps entire App in `src/App.tsx`

- [x] **Standardize error handling pattern** 🟡
  - Created `src/lib/errorHandler.ts` with `handleError(error, userMessage?)` utility
  - Extracts messages from Error objects, Supabase errors, strings
  - Shows toast.error + logs in development
  - Applied in all new domain context files

- [x] **Extract shared auth middleware for Edge Functions** 🟡
  - Already completed in security sprint — `supabase/functions/_shared/auth.ts` with `verifyAuth()`

---

## 5. Testing & Validation 🟠

- [x] **Add unit tests for business logic** 🟠
  - 71 tests across 5 test files covering all pure utility functions
  - `permissions.test.ts` (15 tests): canView, canEdit, getModuleKeyFromRoute, getFullPermissionsForManager
  - `sortUtils.test.ts` (23 tests): compareValues, createComparator, sortArray, filterArray (with Hebrew locale)
  - `advanceOverdueTasksUtils.test.ts` (10 tests): overdue filtering, date advancement, summary formatting
  - `errorHandler.test.ts` (8 tests): error extraction from various types, toast integration
  - `recurringUtils.test.ts` (14 tests): all frequency types (daily, weekly, biweekly, monthly, quarterly, biannual, annual)

- [x] **Add Zod validation schemas for all forms** 🟠
  - Created `src/lib/schemas/`: productSchema, orderSchema, supplierSchema, taskSchema, passwordSchema, employeeSchema
  - Schemas enforce: non-negative prices/quantities, required fields, lead_time_days 1-365 range
  - Matches database CHECK constraints from migration `20260331000001`
  - Integrated into: ProductFormDialog, NewOrderDialog, SettingsPage (password change + employee forms)

- [x] **Add numeric bounds validation** 🟠
  - Merged into Zod schemas: quantities >= 0, prices >= 0, lead_time_days 1-365
  - ProductFormDialog now validates through schema before submit
  - Component-level validation rejects negative values with Hebrew error messages

- [x] **Set up E2E testing framework** 🟡
  - Installed `@playwright/test`, created `playwright.config.ts` (Hebrew locale, dev server integration)
  - Smoke tests in `e2e/smoke.spec.ts`: app load, no JS errors, route accessibility
  - Added `test:e2e` and `test:e2e:ui` npm scripts

- [x] **Configure test coverage reporting** 🟡
  - Installed `@vitest/coverage-v8`
  - Configured in `vitest.config.ts` with v8 provider, targeting `src/lib/**`
  - Added `test:coverage` npm script
  - Reports: text (console) + HTML

- [x] **Validate environment variables on startup** 🟠
  - `src/lib/supabase.ts` now validates: presence of VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
  - Added URL format validation (must start with `https://`)
  - Clear error messages listing which vars are missing, with .env.example reference
  - `.env.example` created with all required variables documented

---

## 6. Observability 🟡

- [x] **Integrate error tracking (Sentry)** 🟡
  - Installed `@sentry/react`, created `src/lib/sentry.ts` with `initSentry()` and `getSentry()`
  - Optional: reads `VITE_SENTRY_DSN` from env — skips entirely when empty (zero overhead)
  - Initialized in `src/main.tsx` before React mount
  - ErrorBoundary and errorHandler forward errors to Sentry via `captureException`
  - Logger adds Sentry breadcrumbs for info/warn logs via callback hooks

- [x] **Implement structured logging** 🟡
  - Created `src/lib/logger.ts` with debug, info, warn, error levels + 12 tests
  - Structured output: `[LEVEL] [ISO timestamp] message {context}`
  - `setLogContext()` for persistent context (userId, role) across all log calls
  - `registerSentryHooks()` callback pattern — no hard dependency on Sentry
  - Replaced all 14 production `console.*` calls across 10 files
  - Only `applyMigrations.ts` (intentional CLI output) retains console calls

- [x] **Add health check endpoint** 🟡
  - Created `supabase/functions/health/index.ts`
  - Pings database via `profiles` table SELECT, measures latency
  - Returns `{ status: "ok", timestamp, db_latency_ms }` or 503 with error
  - No auth required — callable by external monitoring tools
  - Uses shared CORS module

- [x] **Implement user activity logging** 🟡
  - Reuses existing `audit_log` table (no new table needed)
  - Created `src/lib/activityLogger.ts` with fire-and-forget `logActivity()` function
  - Added RLS INSERT policy via migration `20260402100000_audit_log_insert_policy.sql`
  - Integrated into 4 domain contexts: Orders, Products, Tasks, Suppliers
  - Actions logged: create, update, delete for all main entities
  - Naming convention: `entity.action` (e.g., `order.create`, `product.delete`)

---

## 7. Infrastructure & DevOps 🟡

- [x] **Add pre-commit hooks** 🟡
  - Installed `husky` + `lint-staged`
  - Pre-commit: runs ESLint with auto-fix on staged `.ts`/`.tsx` files
  - Pre-push: runs full test suite
  - `"prepare": "husky"` auto-installs hooks on `npm install`

- [ ] **Add Docker setup for local development** 🟡
  - _Deferred — requires Supabase local setup and Docker Compose configuration_

- [x] **Enhance CI pipeline with build and test** 🟡
  - Created `.github/workflows/ci.yml`: checkout → install → lint → type-check → test → build
  - Runs on PR to main/develop and push to main/develop/claude/* branches
  - Node 20 with npm cache for fast installs

- [x] **Document backup and disaster recovery** 🟢
  - Created `INFRASTRUCTURE.md` with: architecture overview, env vars, backup procedures, migration rollback, RLS overview, Edge Function inventory, CI/CD pipeline, incident response runbook

---

## 8. Missing Features 🟢

- [ ] **Email/SMS notifications system** 🟡
  - Create Edge Function for sending notifications
  - Integrate SendGrid or Resend for email delivery
  - Notification triggers: expiring compliance items, overdue orders, task assignments, low stock alerts
  - Add notification preferences per user in Settings
  - Create `notification_templates` table for customizable templates

- [ ] **Bulk data import (CSV/Excel)** 🟡
  - Add CSV/Excel import for: products, suppliers, inventory
  - Create `src/components/ImportDialog.tsx` with file upload, column mapping, validation preview
  - Use `papaparse` for CSV parsing, `xlsx` for Excel
  - Show validation errors before import, allow partial import

- [ ] **Universal data export (CSV/Excel)** 🟡
  - Currently PDF-only export in some places
  - Add CSV/Excel export to all data tables: products, orders, suppliers, tasks, inventory
  - Create `src/lib/exportUtils.ts` with reusable export functions
  - Include filters in export (export what user sees)

- [ ] **Progressive Web App (PWA) support** 🟢
  - Add `vite-plugin-pwa` to build config
  - Create service worker for offline caching of static assets
  - Add `manifest.json` with app metadata and icons
  - Enable offline access for recently viewed data

- [ ] **Two-Factor Authentication (2FA)** 🟡
  - Add TOTP support (Google Authenticator / Authy compatible)
  - Create 2FA setup flow in Settings page
  - Store TOTP secrets securely in Supabase
  - Require 2FA for manager role accounts

- [ ] **Webhook/Integration API** 🟢
  - Create REST API endpoints for external system integration
  - Support webhook subscriptions for events: order status change, stock update, new issue
  - Add API key authentication for external consumers
  - Document API with OpenAPI/Swagger spec
