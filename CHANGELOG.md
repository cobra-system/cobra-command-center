# CHANGELOG

כל השינויים המשמעותיים במערכת COBRA Command Center מתועדים כאן.
פורמט מבוסס על [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-04-12]

- Merge pull request #120 from cobra-system/claude/improve-error-page-mt0oW (fd52c57)
- Add 5 MCP tools for issue management (1f1e9ab)
- Improve IssuesPage to professional level (223e373)

<!-- last-commit: fd52c57b3b81ddbd2c392a750ce5d97a9d95b0a3 -->
## [2026-04-12]

- feat: add interactive logistics center map page (54006cd)

## [2026-04-12]

### Added
- Interactive Logistics Center Map page (`/logistics-map`) — visual warehouse floor plan with clickable zones showing live inventory data from the TLV main center
- Zone-product assignment system: editable product mapping per warehouse zone via `warehouse_zone_products` table
- Search and highlight zones by product name, SKU, or zone name
- Mobile support with pinch-to-zoom and bottom sheet for zone details

## [2026-04-12]

- Disable swipe gestures on MyTasksPage day navigation (6a47441)

## [2026-04-12]

- docs: add /alerts route to README modules table (2a02283)
- feat: merge shipment groups into orders, add בין ספקים type, fix procurement sync (ad925ca)

## [Unreleased]

### Added
- MCP server: 5 new issue tools — `summarize_issues` (KPI counts by status/severity + open high-priority list), `search_issues` (free-text, reporter, product name, date range), `close_issue` (explicit close with required resolution), `bulk_update_issues` (batch status/severity update by filter), `get_issue_with_context` (issue enriched with product name and supplier details)
- IssuesPage: KPI summary cards (total, open, in-progress, critical, closed) with click-to-filter; colored left-border accent stripe per severity; relative date display; description tooltip; icons on severity and status badges; ticket number chip; result count and clear-filter button in filter bar
- "בין ספקים" (supplier-to-supplier) shipping type on orders, with a destination supplier selector in the new-order dialog and order detail page; shown in the orders table
- ReorderPage: live "בדרך" (incoming) quantity computed from actual active orders in real time, refresh button with last-updated timestamp, and "הזמנות פעילות" column showing per-product active order count
- ProcurementAgendaPage: manual refresh button, last-updated timestamp, and automatic refetch when the browser tab regains focus

### Changed
- Shipment Groups merged as a 5th tab inside the Orders page (הזמנות) — no longer a separate page; `/shipment-groups` redirects to `/orders`
- Status filter bar in Orders now shows all 8 order statuses (not just 4) with count badges
- Meetings page removed from navigation; `/meetings` redirects to `/orders`

---

## [2026-04-11]

- Merge pull request #116 from cobra-system/claude/audit-documentation-AkkWf (4355cc6)
- docs: add automated documentation validation system (21b0b9a)
- docs: audit and restructure all markdown documentation (bfea945)


## [2026-04-11]

- merge: resolve conflict in ManagerLayout — keep shipment-groups nav item + equipment label rename from main (8132a12)
- refactor: move procurement agenda from standalone page to tab in OrdersPage (c6b8068)
- feat: add 8 missing UI features — PI/vessel fields, customs statuses, payment schedule, shipment groups, procurement agenda, alerts center, audit log (a2aad38)


## [2026-04-11]

- Merge pull request #114 from cobra-system/claude/fix-rtl-product-integration-oSfcx (214bdd6)
- Phase 3: rename חטיבות tab + add MCP tools for complete page control (5369f1a)
- feat: חטיבות page — bonded entities, inventory sync, waste integration, clean dashboard (f5dd95a)
- feat: overhaul equipment page - RTL, product integration, division panel, new tracking tab (908597c)


## [2026-04-11]

- Add CLAUDE.md with column visibility pattern instructions (7387288)
- Add configurable column visibility to all sortable tables (3af0b4c)
- refactor: sort state — localStorage only, remove URL params (040b8a0)
- feat: persist sort preference across sessions (localStorage) (2e6dc0f)
- feat: configurable column visibility for orders table (ce4fb1f)


## [2026-04-09]

- chore: merge main into branch, register equipment tools (a8afb69)
- fix: address review feedback on shipping integrations (c437571)
- feat: add shipping integrations, payment schedule, and order logistics (3e1874b)


## [2026-04-09]

- Merge pull request #111 from cobra-system/claude/installer-equipment-tracking-xRKGD (a7ad2f7)
- feat: expand MCP equipment tools for full agent operation (c73dd49)
- feat: add MCP tools for equipment tracking (installers, pickups, returns) (42bca3f)
- feat: add installer equipment tracking page (הצטיידויות ובלאי) (deb7cd0)


## [2026-04-09]

- Merge pull request #110 from cobra-system/claude/create-restricted-account-pbCgg (ee9f43c)
- feat: add product-scoped employee access control (973ed3d)


## [2026-04-09]

- Fix country dropdown in supplier form to show all existing countries (3d94ca3)


## [2026-04-09]

- fix(documents): fix garbled PDF text by using pdfjs transform parameter (0d4bab0)
- fix(documents): fix freehand drawing, folder creation errors, and name truncation (3ccee5a)


## [2026-04-08]

- Merge pull request #107 from cobra-system/claude/organize-documents-folders-F0um8 (6d90f89)
- fix(documents): fix RLS policy blocking folder creation for non-manager users (b9151a3)
- fix(documents): fix silent errors, type safety, storage cleanup, and stale selections (ef640c5)
- fix(documents): fix PDF annotation drawing and text rendering quality (1fba7c2)


## [2026-04-08]

- Remove זרימת מלאי tab and fix RTL layout in inventory page (bde94b1)


## [2026-04-08]

- Merge pull request #105 from cobra-system/claude/organize-documents-folders-asBkf (eba57a3)
- feat(documents): Phase 3 — document tracking, bulk actions, inline PDF viewer (7160150)
- Add real folders, PDF annotation editor, and digital signature to documents page (5ded2b5)
- Redesign documents page with Google Drive-like folder UI (a527460)


## [2026-04-08]

- Merge pull request #104 from cobra-system/claude/fix-recent-sort-vjqMB (deffd3b)
- Fix RTL badge direction in archive tab trigger (afaec54)
- Add archive tab for ARRIVED orders, hide them from main table (a6bc06f)
- Offer inventory update when order is marked as ARRIVED (32faec2)
- Fix updated_at sort to use Date comparison instead of string localeCompare (3065680)


## [2026-04-08]

- Fix data not loading after React Query migration (2a85656)


## [2026-04-07]

- Merge origin/main: incorporate context menus into extracted components (392e1ae)
- Merge origin/main into feature branch (5db3688)
- Update TODO.md with all completed tasks (6ca8775)
- Migrate all context providers to React Query (aaa0b7e)
- Set up Playwright E2E testing framework (cc7fac6)
- Extract sub-components from large pages, add infrastructure docs (db78a2d)
- Add audit logging to employee Edge Functions (5dddaa6)
- Integrate Zod validation into order and employee forms (dfebc8c)
- Fix CI: fix password regex lint error, make lint non-blocking (8ed2b6e)
- Add pre-commit hooks and CI pipeline (4f400a8)
- Address PR review comments: fix rate-limit comment, password regex, auth error handling (f3bef6d)
- Add observability: structured logging, Sentry, health check, activity logging (c514aac)
- Add testing & validation: unit tests, Zod schemas, coverage config (6d15be0)
- Architecture improvements: split AppContext, add ErrorBoundary, error handler (f9b1b1d)
- Implement performance improvements: N+1 fixes, lazy loading, indexes, caching (2e053c5)
- Implement critical security hardening and database constraints (c0e01bf)
- Update and reorganize TODO.md with priorities and accurate status (151576d)


## [2026-04-07]

- feat: expand context menus with additional actions across all entities (5d6b797)
- feat: add right-click context menus throughout the system (b5beaab)


## [2026-04-06]

- Merge pull request #101 from cobra-system/claude/product-autocomplete-feature-oT3fb (0c4cda4)
- feat: add product autocomplete to waste management form (892e3d6)


## [2026-04-06]

- feat: add last updated column to orders table (cf8b141)


## [2026-04-05]

- fix: add start_date range support to MyTasksPage (bef5dc5)


## [2026-04-04]

- feat: mobile-first UI for employee inventory and product pages (121470b)
- feat: allow inventory editors to update component stock_qty (4833e50)
- feat: allow employees with inventory edit permission to manage inventory (1feabc9)


## [2026-04-04]

- Resolve merge conflict in orders.ts — keep tracking_number + sap_doc_entry strategies (a50b118)
- שלב 4: ביקורת מקיפה — תיקון באגים, enums, ותיאורים ב-15 קבצי כלים (6f0bcaf)
- שלב 3: ניקוי SAP, הרחבת חיפוש, והשלמת פערים (03fcea3)
- עדכון כלי MCP קיימים — שדות חדשים + 7 כלים חסרים (5108bd5)
- הרחבת כלי MCP — הוספת 18 כלים חדשים לסגירת פערי כיסוי טבלאות (14c6a21)


## [2026-04-02]

- Update package-lock.json after removing MSAL dependencies (6679732)
- Clean up remaining SAP/Outlook artifacts (560e0ff)
- Remove SAP Business One and Outlook integrations (9e5363d)


## [2026-04-01]

- fix: ensure waste_items table is created and verified before marking migration complete (997466d)
- fix: enable waste item creation for all users on mobile and replace toggle with checkbox (f7f554c)


## [2026-03-31]

- feat: redesign mobile employee waste management with card-based UI (27de66c)


## [2026-03-31]

- feat: add waste management page (ניהול בלאי) (73b1698)


## [2026-03-31]

- טופס עריכת משימה משופר עם כל השדות + אפשרות עריכה לעובדים (407fefa)


## [2026-03-31]

- הסתרת הזמנות שהושלמו מטבלת ההזמנות ומהדשבורד (f79964b)


## [2026-03-30]

- fix: resolve RLS policy violation blocking non-manager task creation (b771506)


## [2026-03-30]

- fix: gracefully handle missing created_by column in task creation (39547ff)


## [2026-03-30]

- fix: enable full task creation for all users and fix created_by column error (e85a38d)


## [2026-03-30]

- Reverse swipe and navigation button directions in MyTasksPage (9d15367)


## [2026-03-29]

- Merge pull request #85 from cobra-system/claude/fix-task-creation-swipe-6x9ll (c2caf37)
- fix: employee task creation RLS + add swipe day navigation (53506ba)


## [2026-03-29]

- Add rewrites configuration in vercel.json (8f75387)


## [2026-03-29]

- fix: add error handling to all major silent mutation operations (dfcc6ad)
- feat: set daily view as default and reorder tasks page tabs (193991f)
- fix: also guard completed_at and created_by columns in schema cache migration (b16a2f3)
- fix: resolve PostgREST schema cache error for recurring task creation (15558dc)


## [2026-03-29]

- Merge pull request #83 from cobra-system/claude/task-calendar-display-t3jlh (aa92f6b)
- Show date-range tasks on every day between start_date and due_date (7901d8f)


## [2026-03-29]

- Disable process option in task creation dialog (f400476)


## [2026-03-29]

- fix: show orphan milestones in GoalsManageDialog when goals table is empty (97aad2f)


## [2026-03-29]

- Merge pull request #81 from cobra-system/claude/overdue-tasks-update-C9tjL (0886858)
- Merge pull request #80 from cobra-system/claude/fix-goals-panel-wSBut (8ef8b46)
- Replace auto-advance overdue tasks with interactive daily review panel (915ce3a)
- Fix goals panel: show task milestones and support edit/delete (34f4c59)


## [2026-03-29]

- fix: use supabase/setup-cli action instead of npm install -g (d512172)


## [2026-03-29]

- Merge pull request #79 from cobra-system/claude/fix-user-status-creation-i5hut (89c8cf6)
- feat: remove PIN auth — all employees use email + password (1871dc6)
- fix: support PIN-only employee creation and save PIN to profile (3ede3c9)


## [2026-03-29]

- ci: add Edge Functions auto-deploy and PostgREST schema cache reload (5af0c5f)


## [2026-03-29]

- Merge main and resolve TODO.md conflict (keep both MCP status + system improvements) (bba008e)
- Update TODO.md with completed status for all MCP improvements (b97c14b)
- Register missing tools and add coverage for uncovered DB tables (22e265d)
- Fix 10 MCP tool bugs: non-existent columns, tables, and wrong Hebrew values (540dbb0)
- Add 6 new MCP tool modules: analytics, notifications, bulk-ops, search, finance, reminders (3331344)
- Add MCP new capabilities TODO list (083d2f0)


## [2026-03-29]

- Merge pull request #77 from cobra-system/claude/fix-task-counter-screenshots-ODP6F (902d0ae)
- fix: sync header task counter to match daily task page filtering (ced25cc)


## [2026-03-29]

- Merge remote-tracking branch 'origin/main' (15d6093)
- feat: add date history navigation to DailyReportWidget (b6569ae)


## [2026-03-29]

- fix: correct Supabase URL usage in user creation and manage-employee (18c6788)


## [2026-03-29]

- fix: update RLS policy to allow employees to create self-assigned tasks (db32067)
- feat: employee self-task creation and smart completed task filtering (9e1d69e)


## [2026-03-27]

- Merge pull request #74 from cobra-system/claude/system-improvements-list-9I5m8 (cf53b2d)
- docs: add comprehensive system improvements TODO list (285ab7f)


## [2026-03-27]

- Merge pull request #73 from cobra-system/claude/remove-lovable-edit-Zzm9P (1107c5b)
- Remove Lovable integration and all references (22abb05)


## [2026-03-26]

- Merge pull request #72 from cobra-system/claude/fullscreen-user-display-Nnjw4 (39afb2f)
- Make employee layout fullscreen by removing max-width constraint (443d7f0)


## [2026-03-26]

- fix: count all non-Israel suppliers as abroad in orders dashboard (b53be14)


## [2026-03-26]

- Merge pull request #70 from cobra-system/claude/delete-tasks-fix-goals-OyGHQ (ca861c8)
- feat: add task delete button and fix goals display in Gantt (13061f9)


## [2026-03-26]

- Merge pull request #69 from cobra-system/claude/user-management-settings-ueJ8F (ed98721)
- Replace PIN-based team management with email+password user management (560419b)


## [2026-03-26]

- fix: add missing Zap import in TaskWeeklyView (8293ce2)


## [2026-03-26]

- Merge pull request #67 from cobra-system/claude/add-mcp-tools-9lC5C (f4ed1cb)
- feat: add MCP tools for compliance, team management, and meetings (2811035)


## [2026-03-26]

- feat: redesign DailyReportWidget as compact accordion (cb90cf6)


## [2026-03-26]

- Merge pull request #66 from cobra-system/claude/remove-process-visibility-5ndpy (15f13ff)
- Remove process (תהליכים) visibility from task views (367226c)


## [2026-03-26]

- fix: restore correct UTF-8 encoding in DailyReportWidget (de9b0ec)


## [2026-03-26]

- fix: correct DailyReportWidget interfaces to match JSONB data structure (cbfa5e8)


## [2026-03-26]

- Merge pull request #65 from cobra-system/claude/add-order-status-tracking-XtTlO (9ec3c3c)
- Replace 4 summary cards with Israel/abroad in-process order cards (073668f)


## [2026-03-26]

- fix: enable custom roles to be assigned to workers and configured with permissions (d8febcf)


## [2026-03-26]

- fix: prevent null dereference in TaskDetailDialog (7176189)


## [2026-03-26]

- feat: add weekly scale mode to Gantt chart (0d3525c)
- fix: show updated field values immediately after inline edit in task dialog (2459cb4)


## [2026-03-26]

- Add create_one_time_task MCP tool and category column migration (67481a8)


## [2026-03-26]

- Fix action_items.filter crash by normalizing JSONB array fields (22a883d)


## [2026-03-26]

- Remove Lovable branding and tagger plugin (75154e4)


## [2026-03-25]

- refactor: merge recurring_tasks table into tasks table (dd10fdb)
- fix: recurring tasks showing duplicates and incorrect frequency matching (a6efaa6)


## [2026-03-25]

- Merge pull request #57 from cobra-system/claude/task-inline-editing-y8iYy (d1cec4e)
- feat: replace task detail edit mode with inline double-click editing (ab02dc1)


## [2026-03-25]

- Merge pull request #56 from cobra-system/claude/daily-reports-dashboard (15dc9cd)
- fix: daily_report -> daily_reports table name in widget (04a0d84)


## [2026-03-25]

- Merge pull request #55 from cobra-system/claude/user-type-views-JRVnZ (41c59d9)
- feat: add employee bottom navigation for permitted modules (b0f3e9f)


## [2026-03-25]

- merge: resolve conflict with main, keep mobile fixes + DailyReportWidget (b41ddb9)
- fix: improve mobile/iPhone layout across all main pages (03c0ce1)


## [2026-03-25]

- resolve merge conflict in index.ts - keep daily-reports import (32f890a)
- feat: daily reports dashboard widget + MCP tools (71e083b)


## [2026-03-25]

- feat: make payment status and document type/status inline-editable (c739a63)


## [2026-03-25]

- Merge pull request #51 from cobra-system/claude/new-session-AZUhe (50b8d1e)
- fix: add missing role_permissions table and other post-2026-03-15 migrations (9c09b24)


## [2026-03-25]

- Fix advance-overdue-tasks workflow failing with exit code 3 (2f9c934)


## [2026-03-25]

- fix: verify goals table exists before marking migration complete (76fc45e)


## [2026-03-23]

- Merge pull request #48 from cobra-system/claude/workflow-management-api-QY3Sn (318a81b)
- feat: add workflow, payment, and enhanced order/document/product MCP tools (78c3e24)


## [2026-03-23]

- Merge pull request #46 from cobra-system/claude/fix-goal-creation-gkDNg (f3a582a)
- fix: apply goals table migration at runtime to resolve schema cache error (80c0ef6)


## [2026-03-23]

- Fix permissions editing: surface Supabase errors and add WITH CHECK to UPDATE policy (de68f71)


## [2026-03-23]

- feat: add goals DB table and management UI for Gantt view (eb46c3e)
- feat: grouped Gantt view by goals (מטרת-על) with colored categories (5306009)


## [2026-03-23]

- Merge pull request #44 from cobra-system/claude/meeting-participants-documents-KqQwI (d15ff19)
- feat: structured meeting participants + document upload (9357bcb)


## [2026-03-23]

- fix: remove unused circular import in permissions.ts causing TDZ error (9dbd1a8)


## [2026-03-23]

- fix: move advanceOverdueTasks declaration before its useEffect usage (24554c4)


## [2026-03-23]

- Merge pull request #41 from cobra-system/claude/add-order-fields-OFuGZ (98ab3e4)
- Add missing order fields to MCP tools (order_date, total_price, payment_status, payment_date, contact_name, supplier_name) (b6ebe73)


## [2026-03-23]

- Merge pull request #40 from cobra-system/claude/update-readme-changelog-q9Rr1 (4eef836)
- Merge pull request #39 from cobra-system/claude/auto-advance-overdue-tasks-BwIyv (08e4779)
- Merge pull request #38 from cobra-system/claude/product-linking-drag-drop-hJABb (bf3d57c)
- docs: update README and add CHANGELOG with auto-update workflow (95c8bfd)
- Implement auto-advance overdue tasks feature (e1eb732)
- feat: add multiple product linking and drag-drop file upload (b6ea5b5)


## [2026-03-23]

### נוסף
- **פגישות:** עמוד ניהול פגישות עם פרוטוקולים ופריטי פעולה (#37)
- **מחיקת מוצר:** אפשרות מחיקת מוצר מתיק המוצר (#36)
- **מספר מעקב:** הוספת שדה Tracking Number להזמנות (#35)
- **גאנט:** תצוגת גאנט למשימות עם תלויות ועריכת גרירה (#32)
- **הרשאות:** מערכת הרשאות גרנולריות לפי תפקיד ומודול (#31)

### תוקן
- תיקון רצף Workflow לאישור: כספים לפני רכש (#34)
- תיקון כפתור תשלום: מעבר מדאבל-קליק לקליק בודד (#33)
- תיקון RTL בטבלאות ובכותרות עמוד (#30)

---

## [2026-03-22]

### נוסף
- **MCP:** כלי העלאה וניהול מסמכים ל-Claude Code
- **גרירה:** drag-and-drop משימות בתצוגה חודשית (#23)
- **תצוגת הזמנות:** החלפת Kanban ב-Dashboard ויזואלי (#22)

### תוקן
- תיקון תצוגת משימות חוזרות בכל תצוגות הלוח שנה (#27)
- תיקון RTL בגרפים ורכיבי UI שונים (PRs #24–#29)
- תיקון סידור היפוך כפול ב-RTL בדף הזמנות

---

## [2026-03-19]

### נוסף
- **הורדת PDF:** כפתור הורדת PDF בדף פירוט מסמך (#18)
- **מחיקת קבצים:** אפשרות מחיקת קבצים מ-Storage
- **Middle-click:** פתיחת קישורים בלשונית חדשה (#19, #20)
- **מיון ETA:** מיון הזמנות לפי תאריך יעד + עדכון תבניות Workflow (#21)

### תוקן
- תיקון שגיאות עדכון מוצר ו-supplier_id שגוי (#17)

---

## [2026-03-18]

### נוסף
- **תצוגה מקדימה:** תמיכה בתצוגת Excel ו-Word בדפדפן (#15)
- **ספק ישראלי:** Workflow רכש לספקים ישראלים (#14)
- **Combobox:** החלפת Select ב-Combobox עם חיפוש בטפסים
- **כפתור שכפול הזמנה:** הוספת כפתור Duplicate Order
- **יצירת מוצר מספק:** אפשרות ליצור מוצר ישירות מדף הספק
- **MCP:** תיקון list_suppliers וכלי CRUD נוספים (#16)

---

## [2026-03-17]

### נוסף
- **מיון אוניברסלי:** מיון עמודות קבוע בכל הטבלאות עם שמירת העדפות (#10)
- **תצוגות משימות:** תצוגה יומית וחודשית עם פילטרים (#9)
- **MCP Server:** שרת MCP לניהול מסד נתונים מ-Claude Code (#11)
- **Migrations CI/CD:** הפעלה אוטומטית של Migrations ב-GitHub Actions
- **RTL:** תמיכה מלאה בכיוון ימין-לשמאל לעברית

### תוקן
- תיקון sanitize שמות קבצים לפני העלאה ל-Supabase Storage (#12)
- תיקון סידור ימים בדף משימות (הסרת שבת, תצוגה מלאה)

---

## [2026-03-16]

### נוסף
- **מחיקת משימה:** אפשרות מחיקת משימה מדף פירוט המשימה
- **Workflow:** לשונית ניהול Workflows בלוח משימות חוזרות
- **פילטרים:** פילטרים ניתנים לסינון בתצוגה שבועית
- **SKU:** אכיפת פורמט UPPERCASE אוטומטי ל-SKU

### תוקן
- תיקון חישוב סכום הזמנה מכל פריטי ההזמנה (#8)
- תיקון פתיחה כפולה של דיאלוגים + זיהוי כפילויות בטפסים (#7)
- שיפור מיפוי מוצרים לספקים לפי supplier_id

---

## [2026-03-08 – 2026-03-15] — הקמה ראשונית

### נוסף
- בסיס המערכת: מוצרים, ספקים, הזמנות, מלאי, משימות
- מסד נתונים Supabase עם 30+ טבלאות
- ממשק עובדים עם כניסת PIN
- מערכת Workflow לרכש
- ציות ורגולציה — מעקב רישיונות
- תכנון רכש חכם (Reorder Points)
- דוחות ו-KPIs
- 12 Edge Functions לשירותים שונים
- תמיכת RTL מלאה לממשק עברי

