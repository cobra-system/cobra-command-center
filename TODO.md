# COBRA Command Center - System Improvements TODO

---

## 1. Security

- [ ] **Remove hardcoded secrets from source code**
  - Files: `src/lib/supabase.ts`, `.env`, `supabase/functions/login-with-pin/index.ts`
  - PIN credentials (1234→noam, 1111→georgi, 2222→ziv) with plaintext passwords exposed
  - Service Role Key exposed in `.env`
  - Move all secrets to Supabase Secrets / runtime environment variables
  - Add `.env` to `.gitignore` if not already there

- [ ] **Restrict CORS on Edge Functions**
  - Files: `supabase/functions/login-with-pin/index.ts`, `supabase/functions/create-employee/index.ts`, `supabase/functions/manage-employee/index.ts`, `supabase/functions/sap-proxy/index.ts`, `supabase/functions/classify-document/index.ts`
  - All Edge Functions set `Access-Control-Allow-Origin: "*"` allowing any origin
  - Restrict to the specific frontend domain only
  - Create shared CORS config module for consistency

- [ ] **Add rate limiting on auth endpoints**
  - Files: `supabase/functions/login-with-pin/index.ts`, `supabase/functions/create-employee/index.ts`
  - No attempt counter or backoff on login-with-pin (brute force possible)
  - No throttling on SAP proxy or employee creation
  - Implement rate limiting using Deno KV or in-memory store with exponential backoff

- [ ] **Strengthen password requirements**
  - File: `supabase/functions/create-employee/index.ts` (line ~52)
  - Currently accepts passwords as short as 6 characters with no complexity
  - Enforce minimum 12 characters, require uppercase + lowercase + numbers + special chars

- [ ] **Implement audit trail for sensitive operations**
  - Create `audit_log` table with columns: id, user_id, action, entity_type, entity_id, details (JSONB), created_at
  - Track: employee creation, password changes, role modifications, record deletions, permission changes
  - Add migration file in `supabase/migrations/`
  - Add logging calls in relevant Edge Functions and AppContext operations

- [ ] **Validate auth tokens properly in Edge Functions**
  - Files: `supabase/functions/create-employee/index.ts` (lines ~28-30)
  - Currently only checks if auth header exists, doesn't validate token expiration
  - Verify token claims and expiration server-side using Supabase admin client

---

## 2. Performance

- [ ] **Implement pagination for data lists**
  - File: `src/contexts/AppContext.tsx` - `refreshProducts()`, `refreshOrders()`, `refreshTasks()`
  - All data loaded into React state without limits
  - Implement cursor-based pagination with configurable page size
  - Add infinite scroll or page controls to: `src/pages/ProductsPage.tsx`, `src/pages/OrdersPage.tsx`, `src/pages/TasksPage.tsx`

- [ ] **Add database indexes on frequently queried columns**
  - Create migration in `supabase/migrations/`
  - Add indexes on: `orders.supplier_id`, `orders.status`, `tasks.assignee_id`, `tasks.status`, `product_components.product_id`, `order_items.order_id`, `compliance_items.expiry_date`
  - Consider composite indexes for common filter combinations

- [ ] **Fix N+1 query patterns**
  - File: `src/contexts/AppContext.tsx` (lines ~308-324)
  - Products and components loaded in separate queries then manually joined
  - Use Supabase `.select("*, product_components(*)")` joins instead
  - Review all data fetching for similar patterns

- [ ] **Add lazy loading / code splitting for pages**
  - File: `src/App.tsx` (router configuration)
  - All 26 pages imported eagerly, contributing to ~1.69MB bundle
  - Convert page imports to `React.lazy()` + `Suspense` wrappers
  - Prioritize heavy pages: OrdersPage (31KB), ProductDetailPage (25KB)

- [ ] **Optimize React Query caching strategy**
  - File: `src/contexts/AppContext.tsx`
  - Full data refresh on every mutation instead of targeted updates
  - Implement optimistic updates for common operations (status changes, edits)
  - Configure stale-while-revalidate with appropriate staleTime per entity type
  - Use React Query's `invalidateQueries` selectively instead of full refreshes

---

## 3. Architecture & Code Quality

- [ ] **Split monolithic AppContext into domain-specific contexts**
  - File: `src/contexts/AppContext.tsx` (977 lines)
  - Split into: `ProductsContext`, `OrdersContext`, `TasksContext`, `SuppliersContext`, `InventoryContext`, `DocumentsContext`
  - Each context handles its own CRUD operations, state, and Supabase subscriptions
  - Create barrel export in `src/contexts/index.ts`
  - Update all consuming components to use specific contexts

- [ ] **Break down large page components into sub-components**
  - `src/pages/OrdersPage.tsx` (~31KB) - extract: OrderFilters, OrderTable, OrderStatusCards, OrderCreateDialog
  - `src/pages/ProductDetailPage.tsx` (~25KB) - extract: ProductInfo, ComponentsList, IssuesList, OrderHistory
  - `src/pages/SettingsPage.tsx` - extract: UserManagement, RoleConfiguration, PermissionMatrix
  - `src/pages/TasksPage.tsx` - already has some extraction but review for further splits

- [ ] **Improve TypeScript type safety**
  - File: `src/contexts/AppContext.tsx` and various components
  - Replace `any` types with proper Supabase generated types from `src/integrations/supabase/types.ts`
  - Add strict null checks where missing
  - Type all function parameters and return values in context providers

- [ ] **Add global Error Boundary**
  - Create `src/components/ErrorBoundary.tsx` with user-friendly fallback UI
  - Wrap App component in `src/App.tsx`
  - Add error reporting (prepare for Sentry integration)
  - Include "retry" and "go home" actions in fallback

- [ ] **Standardize error handling pattern**
  - Establish consistent pattern: try/catch in async functions, toast for user-facing errors
  - File: `src/contexts/AppContext.tsx` - some operations use `.catch(console.error)` (silent failures)
  - Replace all `console.error` silent catches with user notifications where appropriate
  - Create shared error handler utility in `src/lib/errorHandler.ts`

- [ ] **Extract shared auth middleware for Edge Functions**
  - Files: `supabase/functions/create-employee/index.ts`, `supabase/functions/manage-employee/index.ts`, `supabase/functions/sap-proxy/index.ts`
  - Auth verification logic duplicated across functions
  - Create `supabase/functions/_shared/auth.ts` with reusable `verifyAuth()` function
  - Refactor all Edge Functions to use shared middleware

---

## 4. Testing & Validation

- [ ] **Add unit tests for business logic**
  - Currently only 1 example test: `src/test/example.test.ts`
  - Add tests for: `src/lib/permissions.ts`, `src/lib/advanceOverdueTasksUtils.ts`, `src/lib/recurringUtils.ts`, `src/lib/sortUtils.ts`
  - Add tests for utility functions and data transformations in AppContext
  - Target: cover all pure functions and business rules

- [ ] **Add Zod validation schemas for all forms**
  - Zod is installed but barely used
  - Files to add validation: `src/components/products/ProductFormDialog.tsx`, `src/pages/SettingsPage.tsx` (user creation), `src/components/orders/` (order creation)
  - Create schemas in `src/lib/schemas/` directory: `productSchema.ts`, `orderSchema.ts`, `supplierSchema.ts`, `taskSchema.ts`
  - Integrate with React Hook Form using `@hookform/resolvers/zod`

- [ ] **Add numeric bounds validation**
  - File: `src/components/products/ProductFormDialog.tsx` (line ~93) - `Number()` conversion without bounds
  - Add min/max validation for: quantities (>= 0), prices (>= 0), lead times (1-365), stock levels (>= 0)
  - Prevent negative values for all quantity and price fields across all forms

- [ ] **Set up E2E testing framework**
  - Install Playwright or Cypress
  - Create E2E tests for critical flows: login, product CRUD, order creation, task management
  - Add to CI pipeline
  - Configure test database for E2E runs

- [ ] **Configure test coverage reporting**
  - File: `vitest.config.ts`
  - Add coverage configuration with `@vitest/coverage-v8`
  - Set minimum coverage thresholds (e.g., 60% for statements)
  - Add coverage report to CI pipeline

- [ ] **Validate environment variables on startup**
  - Create `src/lib/envValidation.ts`
  - Validate all required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`
  - Show clear error message if missing instead of runtime crash
  - Create `.env.example` with all required variables documented

---

## 5. Observability

- [ ] **Integrate error tracking (Sentry)**
  - Install `@sentry/react` package
  - Initialize in `src/main.tsx` with DSN from env var
  - Wrap App with Sentry ErrorBoundary
  - Add breadcrumbs for key user actions
  - Configure source maps upload in build process

- [ ] **Implement structured logging**
  - Create `src/lib/logger.ts` with log levels: debug, info, warn, error
  - Replace all `console.log`/`console.error` calls (26 total across codebase)
  - Include context: user ID, module, action, timestamp
  - In production: send errors to tracking service; in dev: output to console

- [ ] **Add health check endpoint**
  - Create Edge Function: `supabase/functions/health/index.ts`
  - Check: database connectivity, Supabase auth service, SAP connection (if configured)
  - Return JSON with status per dependency and overall health
  - Add monitoring/alerting on health endpoint

- [ ] **Implement user activity logging**
  - Create `activity_log` table: id, user_id, action, module, entity_type, entity_id, metadata (JSONB), created_at
  - Log key actions: login, view, create, update, delete across all modules
  - Add activity log viewer in Settings page for admins
  - Create migration in `supabase/migrations/`

---

## 6. Missing Features

- [ ] **Email/SMS notifications system**
  - Create Edge Function for sending notifications
  - Integrate SendGrid or Resend for email delivery
  - Notification triggers: expiring compliance items, overdue orders, task assignments, low stock alerts
  - Add notification preferences per user in Settings
  - Create `notification_templates` table for customizable templates

- [ ] **Bulk data import (CSV/Excel)**
  - Add CSV/Excel import for: products, suppliers, inventory
  - Create `src/components/ImportDialog.tsx` with file upload, column mapping, validation preview
  - Use `papaparse` for CSV parsing, `xlsx` for Excel
  - Show validation errors before import, allow partial import

- [ ] **Universal data export (CSV/Excel)**
  - Currently PDF-only export in some places
  - Add CSV/Excel export to all data tables: products, orders, suppliers, tasks, inventory
  - Create `src/lib/exportUtils.ts` with reusable export functions
  - Include filters in export (export what user sees)

- [ ] **Progressive Web App (PWA) support**
  - Add `vite-plugin-pwa` to build config
  - Create service worker for offline caching of static assets
  - Add `manifest.json` with app metadata and icons
  - Enable offline access for recently viewed data

- [ ] **Two-Factor Authentication (2FA)**
  - Add TOTP support (Google Authenticator / Authy compatible)
  - Create 2FA setup flow in Settings page
  - Store TOTP secrets securely in Supabase
  - Require 2FA for manager role accounts

- [ ] **Webhook/Integration API**
  - Create REST API endpoints for external system integration
  - Support webhook subscriptions for events: order status change, stock update, new issue
  - Add API key authentication for external consumers
  - Document API with OpenAPI/Swagger spec

---

## 7. Infrastructure & DevOps

- [ ] **Add pre-commit hooks**
  - Install `husky` + `lint-staged`
  - Pre-commit: run ESLint on staged files, TypeScript type check
  - Pre-push: run tests
  - Configure in `package.json` or `.husky/` directory

- [ ] **Add Docker setup for local development**
  - Create `Dockerfile` for frontend build
  - Create `docker-compose.yml` with: frontend, local Supabase (supabase/supabase-local), PostgreSQL
  - Add `.dockerignore` for node_modules and build artifacts
  - Document in README

- [ ] **Enhance CI pipeline with build and test**
  - File: `.github/workflows/` - currently only migrations and changelog
  - Add workflow: checkout → install deps → lint → type-check → test → build
  - Run on PR and push to main/develop/claude/* branches
  - Add build status badge to README

- [ ] **Document backup and disaster recovery**
  - Create `BACKUP.md` with Supabase backup configuration
  - Document: automated daily backups, point-in-time recovery, restoration procedure
  - Add database migration rollback procedures
  - Document Edge Function deployment rollback

---

## 8. Database Improvements

- [ ] **Add missing unique constraints**
  - Create migration in `supabase/migrations/`
  - Add UNIQUE on `products.sku` (prevent duplicate SKUs)
  - Add UNIQUE on `profiles.id` if not already present
  - Review all tables for missing uniqueness constraints

- [ ] **Add proper foreign key constraints with CASCADE**
  - Review all foreign keys for proper ON DELETE behavior
  - Add CASCADE where appropriate (e.g., deleting a product should delete its components)
  - Add RESTRICT where deletions should be prevented (e.g., supplier with active orders)

- [ ] **Add sensible default values**
  - Review nullable columns that should have defaults
  - Examples: `orders.status` default 'pending', `tasks.status` default 'todo', `products.stock_quantity` default 0
  - Create migration with ALTER TABLE ... SET DEFAULT statements

- [ ] **Add database-level validation constraints**
  - Add CHECK constraints: `stock_quantity >= 0`, `price >= 0`, `lead_time_days > 0`
  - Add NOT NULL where fields should always have values
  - Prevents invalid data even if application validation is bypassed
