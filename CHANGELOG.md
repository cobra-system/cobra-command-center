# CHANGELOG

כל השינויים המשמעותיים במערכת COBRA Command Center מתועדים כאן.
פורמט מבוסס על [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed
- Deployment pipeline smoke test — verify the `claude/**` branch build & deploy flow (Brussels).

---

## [2026-06-22]

- Merge pull request #249 from cobra-system/claude/supplier-payment-chart-7y1ezd (128bab4)
- feat: add SAP monthly payments section to supplier detail page (5cec5e4)

<!-- last-commit: 128bab44849339682945e354c09f803ca47e27f0 -->
## [2026-06-22]

- Merge pull request #248 from cobra-system/claude/supplier-payment-chart-7y1ezd (e07a054)
- feat: add supplier payment bar chart to supplier detail page (33740e6)

## [2026-06-22]

- Enhance product search in add-item modal to include SKU and supplier (f6e77b6)

## [2026-06-17]

- Move orders search bar above all tabs, unify archive search with main search (95648b8)

## [2026-06-17]

- Hide ARRIVED and CANCELLED from status pie chart (5ec5857)

## [2026-06-14]

- Merge pull request #242 from cobra-system/claude/wonderful-knuth-9gjlnv (26bbbf3)
- perf: speed up OrdersPage loading (0e553c3)
- perf: additional ProductsPage optimizations (fbd1494)
- perf: speed up ProductsPage loading (3e45e63)

## [2026-06-14]

- Inline delivery status dropdown, fix order link navigation, always-open partial qty field (7ae3178)

## [2026-06-11]

- Fix "פתח הזמנה" button in RequestDetailPanel not navigating (f70a196)
- Fix division manager product RLS: align is_division_manager() with frontend logic (ee2e92c)
- docs: add reset-monthly-orders to README Edge Functions table (8bffba1)
- Add monthly auto-reset for חודשית order requests (6ff08c4)
- Add "התקבל חלקית" (partially received) delivery status (3a8cb80)
- Allow division managers to set/change supply status on their ordered requests (4a9716a)

## [Unreleased]

### Added
- Monthly auto-reset for חודשית order requests: on the 1st of each month, all fulfilled monthly requests revert to pending, accumulating waiting days from original creation. A system comment ("ההזמנה בוצעה לחודש X") and audit history entry are recorded per request. Division managers can set/change supply status (נשלחה / התקבל חלקית / התקבלה / נקלטה) on their own division's ordered requests.

## [2026-06-10]

- Merge pull request #240 from cobra-system/claude/blissful-pasteur-fof02k (e285ba5)
- feat(ux): complete currency-per-entry & search-in-dropdowns rollout (d051df7)
- feat(ux): add search to all large dropdowns, improve duplicate product message (a713ea7)
- refactor(currency): per-entry currency selection instead of global display toggle (851618b)

## [2026-06-09]

- Merge pull request #238 from cobra-system/claude/blissful-pasteur-fof02k (52e2e32)
- feat(currency): fix mixed-currency aggregation, add compact formatter, configurable rate (4ea7896)
- fix: update DocumentsSection test mock to include useCurrency (5145f32)
- feat: add global ILS/USD currency display toggle (81a327f)

## [2026-06-09]

- Merge pull request #239 from cobra-system/claude/gracious-maxwell-t2B05 (62f5388)
- feat: remove forecast feature from consumption chart (7f5e88b)

## [2026-06-09]

- Merge pull request #237 from cobra-system/claude/gracious-maxwell-t2B05 (e686dc0)
- fix: chart UI — fewer avg lines (12% threshold), no confidence band, clean forecast (2653880)
- fix: X-axis labels showing 'undefined N' — normalize DB date format (c08a32c)

## [2026-06-09]

- Merge pull request #236 from cobra-system/claude/focused-knuth-HfK5j (8dee875)
- docs(claude): update storage key for WasteSupplierReturnsTab (556d3db)
- chore: remove deleted WasteManagementPage.tsx (replaced by WastePage) (7e1dff8)
- docs: update README for waste system rebuild (new routes, tables, edge function) (8e4ed8d)
- feat(waste): rebuild waste management system from scratch (e7fef52)

## [2026-06-09]

- fix: mobile responsiveness for consumption chart, treemap panel & filter bar (581d996)
- feat: forecast in all view modes, smart date range, richer order tooltips, division stockout (7939046)
- feat: enterprise consumption chart — forecast, order markers, stacked view (a476aa9)
- perf: optimize products pages — debounce, memo, precomputed maps (a9344ee)
- refactor: client-side division aggregation + multi-select filter in consumption chart (b5871b7)

## [2026-06-07]

- feat: add avg values on reference lines and division filter to consumption chart (0f333fd)

## [2026-06-07]

- feat: color-code order request rows by division (7ac2003)
- fix: apply missing linked_order_ids migration + add received_qty (7e243f4)
- feat: order requests — delivery status, ETA, george email, fix nav button (26fd845)

## [2026-06-07]

- feat: complete product field audit — gaps G3/G4/G6/G7 (c13ec81)
- feat: division manager can report monthly consumption from products table (d1bc624)
- revert: remove sap_code and supplier_origin fields from products UI (5c9b07d)
- refactor: single consumption column — sum of division monthly_avg (7c0a16d)
- feat: division inventory & consumption visibility across products system (267fad4)

## [Unreleased]

### Added
- **גרף צריכה — תחזית חכמה**: קו תחזית מקוקו 5 חודשים קדימה (ממוצע נע משוקלל 50/30/20%), רצועת אמון (±σ) ומרקר אדום "אזל" בחודש הצפוי לאזילה. אם המלאי עולה על אופק התחזית — מוצג אישור ירוק. מרקר אזילה מוצג בכל מצבי התצוגה (מאוחד / השוואה / מוערם).
- **גרף צריכה — מרקרי הזמנות**: קוים אנכיים מקוקווים בכל חודש שבוצעה הזמנה קשורה, עם בדג כמות. צבע לפי סטטוס (ירוק = נמסר, כתום = בדרך, כחול = הוזמן). מעבר עכבר מציג PI, ספק, כמות ו-ETA. ניתן להסתרה עם כפתור "הזמנות".
- **גרף צריכה — תצוגות מוערמת / השוואה**: כפתורי [מאוחד · השוואה · מוערם] כשיש 2+ חטיבות. "השוואה" — כל חטיבה בקו נפרד; "מוערם" — חטיבות מוערמות כך שהגובה הכולל = סכום.
- **גרף צריכה — פילטר טווח תאריכים**: כפתורי [3m · 6m · שנה · הכל]. ברירת מחדל חכמה: "הכל" אם יש פחות מ-6 חודשי נתונים, אחרת "שנה".
- **גרף צריכה — קו נקודת הזמנה**: קו כתום מקוקו ב-reorder_point כשמוגדר למוצר.
- **גרף צריכה בחטיבה (DivisionConsumptionPage)**: מרקר אזילה מבוסס על מלאי החטיבה הספציפי בעת הרחבת שורת מוצר.
- **ביצועי עמוד מוצרים**: debounce 200ms בחיפוש, מפות pre-computed לצבירת מלאי ו-SKU lookup, React.memo על תאי Treemap, stableKey ב-useLiveProductMetrics.

### Changed
- `useProductConsumption` — שליפה אחת עם כל החטיבות, סינון client-side (מבטל flicker בלחיצה על חטיבה).

---

### Added
- **בקשות רכש — סטטוס אספקה**: עמודת `delivery_status` חדשה עם ערכים: נשלחה / התקבלה / נקלטה. ניתן לעדכון ע"י מנהל רכש ישירות מהפאנל.
- **בקשות רכש — ETA**: תצוגת ETA מתוך ההזמנה המקושרת, בפאנל ובעמודת טבלה.
- **בקשות רכש — מייל לג'ורג'**: כל אירוע הודעה נשלח גם לכתובת george@cobra.co.il.
- תיקון: כפתור "פתח הזמנה" בפאנל הפרטים — ניווט לפני סגירת הפאנל.
- מלאי מפורק לפי מיקום בדף המוצר: קוברה ת"א + כל חטיבה עם סיכום כולל
- KPI "מלאי כולל" בדף המוצר (קוברה + חטיבות) ו"צריכה חטיבות (ממוצע)" — הצריכה המשוקללת לתכנון קוברה
- עמודת "צריכה חטיבות" בטבלת המוצרים — סכום monthly_avg מכל החטיבות, עם מיון
- שדות `קוד SAP` ו-`מדינת מקור` לטפסי יצירה ועריכה של מוצרים
- שדה `מדינת מקור` לטופס יצירת רכיב (BOM)

### Changed
- עמודת "ממוצע SAP" לא מציגה עוד fallback לערך מחושב — רק ערך ידני מ-SAP
- כותרות עמודות: "מכירות חודשיות" → "צריכה (הצטיידות)", "ממוצע צריכה שנתי (SAP)" → "ממוצע SAP"
- stockStatus בדף מוצר מבוסס כעת על מלאי כולל (לא רק קוברה)

## [2026-06-04]

- layout: move consumption chart below product details (d0c4572)

## [2026-06-04]

- Merge pull request #230 from cobra-system/claude/trusting-ritchie-N7Ir4 (99c5c09)
- feat: per-product consumption chart with annual/half-year/quarterly averages (8278cac)
- chore: remove non-bonded division_products data (5882665)
- fix: merge duplicate distribution centers, set SAP codes, recompute monthly_avg (385810b)

## [2026-06-04]

- Merge pull request #228 from cobra-system/claude/trusting-ritchie-N7Ir4 (449c659)
- fix: treemap zoom-out centers map, lock pan at 1x, dynamic viewport height (154d8d4)

## [2026-06-04]

- Merge pull request #226 from cobra-system/claude/trusting-ritchie-N7Ir4 (b4acbaa)
- feat: treemap — reorder alerts, double-click zoom, tooltip clamping (c2cda2f)
- feat: treemap UX polish — rich cells, category stats, gradient legend (dd60f19)
- feat: treemap enterprise features — minimap, issues integration, health filter (545edc2)
- feat: treemap pro — search, stats, division filter, full-screen, quick actions (3a8923a)
- feat: treemap polish — 8-point improvement pass (996753f)

## [2026-06-04]

- Merge pull request #227 from cobra-system/claude/great-hamilton-OQK7b (6edcbf2)
- feat: order request integration in quarterly planning (23d5c23)

## [2026-06-03]

- Merge pull request #225 from cobra-system/claude/great-hamilton-OQK7b (50e33c2)
- feat: quarterly planning improvements — Frisbee mappings, incoming orders, family drill-down (e534bc1)

## [2026-06-03]

- Merge pull request #224 from cobra-system/claude/trusting-ritchie-N7Ir4 (ffcc8f9)
- feat: treemap overhaul, no-categories filter, unified products page (e5f7444)

## [2026-06-03]

- Merge pull request #223 from cobra-system/claude/great-hamilton-OQK7b (1ff1789)
- fix: InlineSelectCell crash — pass correct options format and display prop (c201773)

## [2026-06-03]

- merge: resolve CHANGELOG.md conflict with main (00a0a32)
- feat: redesign division consumption page with health analytics and monthly charts (648b028)
- chore: gitignore vite timestamp temp files (8a6d354)
- feat: add interactive product treemap heatmap view (7c555cc)

## [2026-06-03]

- feat: interactive product treemap heatmap view on Products page
- feat: division consumption analytics with inventory health tracking
- improve: UI/UX enhancements for quarterly planning page (b23fe2c)
- feat: excel import preview, cross-division forecast, snapshots/undo (b6ac02b)
- fix: replace UUID input with product search combobox in mapping dialog (c95726f)
- feat: add quarterly procurement planning page for bonded divisions (c603b48)

## [Unreleased]

### Added
- Unified products page — consolidated `/products` and `/division/:divisionName/products` into a single page; admin sees total stock with expandable per-division breakdown (editable), division managers see their own division stock
- Interactive product treemap/heatmap view on Products page — finviz-style visualization where cell size reflects consumption and color reflects inventory health, with zoom/pan, category grouping, and filters
- Treemap minimap navigator — appears when zoomed in, shows full layout with viewport rectangle, click to navigate
- Product issues integration in treemap — warning badges on cells with open issues, issue count in tooltips and info panel
- Health status filter in treemap — filter by stock health (אזל/קריטי/נמוך/סביר/תקין)
- Zoom level indicator (percentage display) on treemap controls
- Last order date and issue count in treemap tooltip and info panel
- Stats bar shows products with open issues count
- Max zoom increased to 6x for detailed inspection

### Changed
- Treemap quality overhaul — dark Finviz-style color palette, SKU-only cells with dynamic font sizing, plain mouse-wheel zoom, click-drag panning
- Added "ללא קטגוריות" filter option to treemap for flat layout by consumption size without category grouping

### Removed
- Deleted unused DivisionProductsPage (route already redirects to unified /products)
- Division consumption analytics redesign — monthly consumption bar chart, inventory health indicators (color-coded 7-level scale), mini sparklines, sortable/searchable table with column visibility
- `division_product_consumption` table for storing 13-month historical consumption data per division/product
- `monthly_avg` and `monthly_avg_updated_at` columns on `division_products` table
- `useDivisionConsumption` hook for fetching and computing consumption summaries with health ratios
- Quarterly procurement planning page (`/division/:divisionName/quarterly-planning`) for bonded division managers — 3 tabs: vehicle model forecast, product-model mapping, procurement plan with recalculation
- 5 new DB tables: `vehicle_models`, `quarterly_vehicle_forecasts`, `product_model_mappings`, `quarterly_procurement_plans`, `quarterly_plan_snapshots`
- MCP module `quarterly-planning` with 13 tools for vehicle models, forecasts, mappings, procurement plans, and snapshots
- Excel import with header matching and preview table before committing
- Cross-division demand aggregation column ("צפי כולל") showing total forecast across all bonded divisions
- Snapshot/undo: auto-captures plan state before each recalculation, with restore capability
- CSV export for procurement plans

## [2026-06-02]

- fix: pass presetDivision to ProductFormDialog from DivisionProductsPage (4f8e9f9)
- fix: allow division managers to create/edit products & suppliers (3cad00d)

## [2026-06-02]

- sidebar: display role definition name instead of raw role enum (0000f0c)

## [2026-06-01]

- waste: show supplier name in product search combobox (5ea5bc9)

## [2026-05-31]

- Waste management: surface data, financial insights, bulk actions, returns tab (0d6e556)
- Waste: auto-fill supplier, unit cost field, financial summary on dashboard (c666799)
- Fix waste item dialog: add supplier field, fix disposition_type, auto-open create product (aca21b2)

## [2026-05-31]

- refactor: redesign waste management page — 2 tabs, unified form, bug fixes (510fdf0)

## [2026-05-31]

- chore: resolve CHANGELOG merge conflict (4f163ba)
- fix: address Copilot review — reuse shared updated_at trigger, merge photo migration, CSV escaping, fix colSpan for non-editors (2c4cfd3)
- feat(waste): CSV export, photo support, deep linking, supplier returns section in supplier page (8fc8a1d)
- feat(waste): useTablePreferences, realtime, KPI clicks, clear filters, tooltips, AlertDialog, sort icons (d07fcf9)
- feat(waste): mobile layout, search, stuck alerts, CSV export, unlink items, badge navigation (b468ad2)
- feat(waste): mobile layout, search, stuck alerts, CSV export, unlink items, badge navigation (0b1653c)
- feat: waste disposition tracking — supplier returns, destruction, and third-party sales (1e3795e)

## [Unreleased]

### Added
- Waste management: disposition tracking — mark items as destroyed, returned to supplier, or sold to third party
- Supplier returns: full status flow (draft → shipped → received by supplier → settled) with DHL tracking, resolution type (credit/replacement/other), and linked waste items
- Waste statistics tab: KPI breakdown by disposition type and supplier return status
- New `supplier_returns` database table with soft-delete, RLS, and status transitions
- 6 new MCP tools for supplier returns and waste disposition (waste module: 5 → 11 tools)

## [2026-05-27]

- Add column visibility to OrdersHistoryTable (#213) (e09f985)

## [2026-05-19]

- remove supplier comparison (השוואת ספקים) feature (d61f750)

## [2026-05-19]

### Removed
- Supplier comparison panels (השוואת ספקים) from BOM table in product detail page
- Removed `create_supplier_price_quote` and `list_supplier_price_quotes` MCP tools

## [2026-05-18]

- Show managers in task assignee filter dropdown (747e1c0)

## [2026-05-17]

- fix(division-products): add dir="rtl" to Tabs to restore RTL layout (3e23630)
- fix(frisbee): apply RTL layout to Recharts charts and Tabs in DivisionDashboard (d2545ec)

## [2026-05-17]

- merge: resolve conflicts with main (soft-delete + docs) (84d1b2f)
- docs: fix CLAUDE.md divisions tool count and module inventory (be81544)
- docs: update docs for division_product_items feature (f526e24)
- feat: equip divisions with product items (components) (f6062b7)

## [2026-05-17]

### Added
- **ציוד חטיבה — פריטי מוצר**: אפשרות לצייד חטיבות עם רכיבי מוצר בודדים (לדוגמה: מצלמה, תושבת, כרטיס זיכרון) בנוסף למוצרים שלמים. טאב חדש "פריטים" בדף מוצרי חטיבה עם עריכת מלאי שטח, תאריך עדכון, ותפריט נראות עמודות.
- טבלת `division_product_items` עם RLS זהה ל-`division_products`
- 3 כלי MCP חדשים: `list_division_product_items`, `upsert_division_product_item`, `delete_division_product_item`

- Fix gaps: route protection, MCP soft-delete filters, docs (f9d0a69)
- Add /trash route to README modules table (991d8d6)
- Sync George to manager role + add soft-delete for all core tables (a088428)

## [2026-05-14]

### Added
- **Soft-delete לכל הטבלאות המרכזיות** — מחיקה של הזמנה, מוצר, ספק, משימה ועוד 15 ישויות נוספות
  מעבירה אותן לסל מחזור במקום למחוק לצמיתות. trigger ב-PostgreSQL מיירט DELETE אוטומטית.
- **עמוד סל מחזור (`/trash`)** — מנהלים יכולים לראות פריטים שנמחקו, לשחזר אותם או למחוק לצמיתות.
  כולל חיפוש, סינון לפי סוג, וספירת ימים עד תפוגה.
- **pg_cron cleanup** — מחיקה קבועה אוטומטית של פריטים ישנים מ-30 יום (כל יום ב-03:00 UTC).
- **RPC functions**: `get_deleted_items()`, `restore_item()`, `hard_delete_item()` — מנהלים בלבד.

### Changed
- **גיאורגי גריגוריאנץ** שונה מ-`WAREHOUSE_MANAGER` ל-`MANAGER` כדי שתצוגתו תהיה זהה למנהל.
- כלי MCP (orders, products, suppliers, tasks, issues, meetings, compliance, goals, search)
  מסננים פריטים מחוקים מתוצאות.

## [2026-05-13]

- refactor: rename FrisbeeDashboard → DivisionDashboard (af3df4c)
- fix: correct RTL DOM order in FrisbeeDashboard tabs (b033751)

## [2026-05-13]

- fix(order-requests): bypass stale division filter for division managers (70e2b98)
- fix(frisbee): add DB-level sync throttle and skip auto-sync when data is fresh (3e55a38)
- fix(rtl): align pivot table month headers to right in FrisbeeDashboard (b50c2c7)
- fix(frisbee): add 5-minute rate limit to sync-frisbee and sync-lubinski (b236db0)

## [2026-05-13]

- feat(consumption): auto-sync on page load for bonded division dashboards (67736ed)
- docs: add sync-lubinski to README edge functions table (d818b58)
- feat(lubinski): add Base44 sync and consumption dashboard for לובינסקי division (66cd6c8)
- docs: add bonded division routes to README modules table (0bc3478)
- refactor(bonded-divisions): replace monolithic DivisionDetailPage with dedicated pages (4eaba2f)

## [2026-05-12]

- Store Yaki's Base44 credentials and prep future inspection fields (261dfca)
- Add FrisbeeDashboard: 3-tab analytics for division manager (a0dd9e7)

## [2026-05-12]

- feat(frisbee): Base44 QA inspection sync + equipment consumption analytics (59ef79a)

## [2026-05-12]

- fix(orders): remove dropdown icons + open order navigates to detail page (9109f38)

## [2026-05-11]

- feat(orders): collapse date filters into popover and unify row actions in overflow menu (cc42ec2)
- feat(orders): simplify purchase-request tab UX per division-manager feedback (b8b409c)
- fix(orders): polish purchase-request tab for division managers (f71f7fd)

## [2026-05-11]

- feat(orders): simplify purchase-request UI for bonded division managers (4db1dd7)

## [2026-05-10]

- fix(dates): correct misplaced `new` keyword breaking date formatting (5638b67)

## [2026-05-10]

- Finish DD/MM/YYYY rollout + auto-refresh division products list (0ac345a)
- Standardize all date displays to DD/MM/YYYY + fix DivisionDetailPage crash (e0c06b6)
- Drop footer row + offer attach-to-existing-order on הזמן (dd749a0)
- Open product picker to all products, add create-new + attach flow (eff0a9d)
- Trim order-request UI per request (25fdcc5)
- Inline-edit order requests table and tidy the action column (218d14c)

## [2026-05-09]

- fix(division-detail): hoist isBonded above useEffect that depends on it (9c2b198)

## [2026-05-09]

- merge: resolve OrdersPage tabs conflict with main (8557218)
- feat(edge): load notification config from app_config table (Resend + VAPID inline) (1c6f649)
- feat(order-requests): wave 7 — utilization normalize, stock snapshot, push dispatch (813f40f)
- refactor(order-requests): single source of truth for division_stock (61b9d3a)
- docs: register dispatch-order-request-notifications Edge Function (7184f5a)
- feat(order-requests): wave 5 — stock unification, reverse flow, notifications (afa1bf7)
- feat(order-requests): wave 4 — persistence, clone, snapshots UI, dedupe (52f229f)
- feat(order-requests): wave 3 — Excel I/O, attachments, snapshots, lead-time (15e6816)
- feat(order-requests): wave 2 — detail panel, comments, bulk fulfill, realtime (eb3dd75)
- feat(order-requests): complete the bonded-division procurement workflow (c7d85b3)

## [Unreleased]

### Added — Base44 QA sync: צריכת אביזרים לפריזבי קרסו

- **3 DB tables**: `frisbee_inspections`, `frisbee_inspection_equipment`, `frisbee_product_mapping` + view `frisbee_equipment_consumption`
- **Edge Function `sync-frisbee`**: מסנכרן את כל בדיקות ה-QA (~4,000) מ-Base44 API לסופה‑בייס (upsert על base44_id; rebuild equipment items)
- **MCP module `frisbee`**: 5 כלים — `sync_frisbee_data`, `get_frisbee_consumption`, `get_frisbee_inspections`, `update_frisbee_product_mapping`, `list_frisbee_product_mappings`
- **DivisionDetailPage**: סקשן חדש "צריכת אביזרים (QA)" עבור פריזבי קרסו ודלק מוטורס — KPIs + טבלת צריכה עם מיפוי למוצרים פנימיים + column visibility

### Added — בקשות הזמנה (order requests) for bonded divisions

A complete planning + fulfillment loop with collaboration, snapshots, notifications, and the Excel-equivalent column layout used by procurement.

- **Inline editing** of urgency / order type / quantity / required_to_order from the table; dialog covers full creation flow with product autocomplete and price/lead-time prefill.
- **Detail panel** with comments thread, audit history, attachments, related order link, lead-time + value summary; compact / spacious / mobile-card layouts.
- **Status lifecycle** (`pending → ordered / rejected / cancelled` with `revert`) gated by role; division managers see only their own division.
- **Bulk fulfill** groups selected pending requests by supplier and creates one purchase order per supplier in one click.
- **Excel I/O** — paste-from-Excel TSV importer (matches by SKU, then by name; can create missing rows) and CSV export covering all 22 planning columns.
- **Snapshots** — save/restore named planning-table snapshots stored in DB; restore mode shows a clear banner with side-by-side compare.
- **Reverse flow** — when a manager creates a manual order, the matching pending request (in any bonded division) is auto-linked, marked ordered, and a comment is posted if the actual qty differs from what was requested.
- **Notifications** infrastructure — `notification_subscriptions` + `notification_queue` tables, triggers on lifecycle / urgency / comments, an Edge Function `dispatch-order-request-notifications` that sends email via Resend and Web Push via VAPID, plus a service worker, opt-in dialog, and realtime in-app toasts (RLS-filtered).
- **Tab rename** — division managers see "רכש מוצרי חטיבה" instead of "טבלת הזמנות".

### Changed — single source of truth for division stock

- `division_products.field_stock` renamed to `division_stock`.
- `order_requests.division_stock` column **removed**; the canonical "current stock per (division, product)" lives only in `division_products`. The frontend hydrates the field client-side via a single fetch + lookup. Inline edits write to `division_products` only. Eliminates the dual-write race condition that the wave-5 bidirectional sync triggers had.

### Removed
- Wave-5 bidirectional sync triggers between `division_products.division_stock` and `order_requests.division_stock` (replaced by the single-source-of-truth model above).

---

## [2026-05-08]

- fix(orders): align header fixed columns with data rows (photo + copy + delete) (d30d71e)
- feat(orders): show archive tab for division managers (already scoped by division) (7727af9)
- rename: orders page to רכש, active orders tab, order requests tab (f3f4b05)
- fix(orders): remove shipment-groups tab, deduplicate procurement tabs, fix RTL order (574ab64)
- fix: make sidebar sticky so user profile stays at bottom of viewport (98df496)

## [2026-05-08]

- fix(security): close payment-terms / global-search leaks; add regression tests (9eeed7c)
- fix(order-requests): redesign tab with proper RTL, header card, and mobile cards (aa4701e)
- fix(security): column-mask product prices via _safe views; tighten edge cases (08bc1fc)
- fix(security): hide order notes + audit log from division managers; add RLS migration (71c9e34)
- fix(security): hide all money and documents from division managers (ada1144)

## [2026-05-08]

- revert(auth): drop Google OAuth from login (633092c)
- fix(auth): generated password meets server validatePassword rules (3b7f9ca)
- docs: add signup route and signup edge functions to README (872b6cc)
- feat(auth): account approval workflow with Google OAuth + email signup (f0ff4cf)

## [2026-05-08]

- feat(order-requests): SKU search + bonded division Excel-style table (c3811f1)

## [2026-05-08]

- fix(rls): products SELECT policy referenced products.division in subquery (7f5735f)
- fix(orders): close Phase 2 division-manager gaps (3a7c7a6)

## [2026-05-07]

- fix(orders): division managers now see all orders containing their products (3749f35)
- feat(divisions): add order requests workflow for bonded division managers (16229f7)

## [Unreleased]

### Security
- **חסימה גורפת של כסף ומסמכים ל-non-MANAGER** — הגנה כפולה (UI + DB):
  - `DocumentsSection` ו-`OrderPaymentsSection` ו-`OrderAuditLog` self-gate ב-`canSeeDocuments`/`canSeePrices`. סוגר דליפות ב-ProductDetail, OrderDetail, SupplierDetail.
  - `ProductDetailPage`, `ProductsPage`, `BOMTable`, `SupplierDetailPage`, `OrderDetailPage` מסתירים שדות מחיר, סקציות תשלומים, עמודות `סה״כ`, ו-`order.notes` למשתמשי non-MANAGER.
  - `ProductEditDialog` ו-`ProductFormDialog` מסתירים שדות `purchase_price`/`sale_price` ל-non-MANAGER.
  - **DB**: RLS על `purchase_documents`, `supplier_payments`, `order_payments`, `order_notes_history` — כל פעולה (SELECT/INSERT/UPDATE/DELETE) דורשת `is_manager()`.
  - **DB**: views `products_safe` ו-`product_components_safe` עם `security_invoker` שמסווים את עמודות המחיר ל-`NULL` עבור non-MANAGER. `ProductsContext` קורא דרך ה-views.
- `OrdersPage` search לא כולל `notes` ל-non-MANAGER (מונע value-oracle).
- `ProductsPage` מאפס `sortField` ל-`name` אם השמור הוא `purchase_price`/`sale_price` ל-non-MANAGER.

### Added
- **תהליך אישור הרשמה** — דף הכניסה כולל אימייל/סיסמה, "שכחת סיסמה?" וקישור להרשמה. הרשמות חדשות אינן נכנסות אוטומטית למערכת — נוצרת רשומה ב-`signup_requests` ומייל אישור נשלח ל-`noamshemla@gmail.com` ול-`noam@cobra.co.il`. מנהלי המערכת מקבלים טאב "בקשות הרשמה" בהגדרות, שם ניתן לאשר (עם בחירת תפקיד, אגף וסיסמה ראשונית שתישלח למבקש) או לדחות את הבקשה.
- **DB**: טבלת `signup_requests` חדשה עם RLS למנהלים בלבד; אינדקס ייחודי על אימייל ממתין כדי למנוע כפילויות.
- **Edge Functions**: `request-signup` (ציבורי, יוצר את הבקשה ושולח מייל למנהלים) ו-`review-signup-request` (מנהלים בלבד, יוצר משתמש ב-`auth.users` + פרופיל + `user_roles` או דוחה ושולח מייל למבקש).

- **בקשות הזמנה** — מנהלי חטיבות בונדד (דלק מוטורס, פריזבי קרסו, לובינסקי) יכולים לפתוח בקשות הזמנה ישירות מדף החטיבה. כל בקשה כוללת מוצר (עם ספק אוטומטי), כמות, צריכה נוכחית, סיבה, דחיפות וסוג הזמנה. מנהל הרכש רואה את כל הבקשות בטאב ייעודי ב-OrdersPage ומממש כל בקשה בכפתור "הזמן" שפותח NewOrderDialog עם נתונים מולאו מראש; עם שמירת ההזמנה הבקשה מסומנת כ"הוזמן" ומקושרת להזמנה.
- **פרטיות מחירים** — מנהלי חטיבות אינם חשופים למחירים, עמודות תשלום (סה"כ, תשלום, PI Number) ולטפסי הזמנה ישירים. הם רואים רק את טבלת ההזמנות וטאב הבקשות.
- **DB**: טבלת `order_requests` עם RLS — מנהל חטיבה מכניס/רואה רק את החטיבה שלו, מנהל רכש מעדכן/מוחק.
- **MCP**: שלושה כלים חדשים — `list_order_requests`, `create_order_request`, `fulfill_order_request`.

## [2026-05-04]

- feat: add drag-and-drop and paste (Ctrl+V) to all file upload areas (fb1f7df)
- fix: remove non-existent inventory_change_log from product deletion (aa7fb31)

## [2026-05-04]

- Allow toggling payment status directly from table (a7e88b7)

## [2026-05-04]

- feat: add download button to compliance license cards (69b9147)

## [2026-05-03]

- Merge remote-tracking branch 'origin/main' into claude/fix-order-payments-ihQUE (ef5205c)
- fix(migration): backfill order_payments from legacy payment_status before dropping columns (fe80935)
- refactor(orders): unify payment system, remove procurement workflow (436b5aa)

## [Unreleased]

### Changed
- **Payment system unified** — removed the legacy `orders.payment_status` / `orders.payment_date` fields. Payment status is now derived exclusively from the `order_payments` table (ממתין / שולם חלקי / שולם). The "מעקב תשלומים" summary card on the order detail page is gone; "תזמון תשלומים" is the single payment UI. Discrepancies between scheduled total and order total now surface in the payment schedule summary bar.
- **Workflow feature removed** — the "הזמנת רכש מחו"ל" procurement workflow (6-step process) has been removed entirely: WorkflowsPage, WorkflowsPanel, OrderWorkflowTimeline, workflow MCP tools, DB tables (`workflow_templates`, `workflow_instances`, `workflow_step_logs`), and all auto-start/cleanup logic. 32 MCP modules (246 tools) remain.
- **Map view** — Kanban columns switched from workflow-step grouping to order status grouping (ממתין / הוזמן / נשלח / נמל-מכס-נמסר).

## [2026-05-03]

- Persist product categories in DB (product_categories table) (4bf4895)
- Add category management and number inputs for inventory thresholds (7faa5bc)

## [2026-05-03]

- Merge pull request #182 from cobra-system/claude/collapsible-tracking-widgets-vjttq (7671a1b)
- ui(tracking): compact status badge in orders table (dab3af2)
- ui(tracking): collapse DHL/TCLOG widgets by default (3306a01)

## [2026-05-03]

- feat(lock-control): add open-all button, remove refresh (faa6e31)
- fix: add end_date column to tasks for recurring templates (f35b24f)

## [2026-05-01]

- feat(tracking): phase 2 — auto-detect, bulk tagging, filters, MCP parity (7cdfdd0)
- ui(tracking): rename "ספק המעקב" to "חברת שילוח" (b64723c)
- fix(tracking): tracking_number can be DHL or TCLOG — require explicit carrier (a0fbb57)
- feat(tracking): rich DHL tracking widget + auto-sync on orders page (ab12a9d)

## [Unreleased]

### Added (Phase 2)
- זיהוי אוטומטי של חברת שילוח לפי פורמט מספר מעקב (`src/lib/trackingCarrierDetect.ts`) + bachfill בטוח של 19 הזמנות קיימות
- בחירת חברת שילוח inline בטבלת ההזמנות עם הצעה אוטומטית
- בחירה מרובה (checkbox) ב-OrderTable + סרגל פעולות bulk לסימון חברת שילוח להמוני הזמנות
- כלי MCP `bulk_update_tracking_carrier` לסימון חברת שילוח להזמנות מרובות
- סינון בעמוד ההזמנות לפי חברת שילוח ולפי מצב מעקב (במעבר/נמסר/תקלה/לא סונכרן/שגיאה)
- סנכרון ETA: כפתור inline בכרטיס ה-ETA כש-DHL חזה תאריך שונה מהידני
- הצעת "סמן כהגיעה" כש-DHL מדווח על מסירה (toast חד-פעמי לכל סשן)
- כלי MCP `track_shipment_dhl` ו-`update_order_eta_from_dhl` כותבים עכשיו את כל השדות המנורמלים (`tracking_status_code`, `tracking_eta`, `tracking_events`, ...) בנוסף ל-`eta` הישן
- באנר שגיאות סנכרון ב-OrdersPage כשיש הזמנות עם `tracking_sync_error`, עם פירוק לפי קוד שגיאה וקישור לסינון
- בדיקות יחידה ל-`trackingCarrierDetect` ול-`dhlStatusMap`

### Added
- מעקב DHL מורחב: וידג'ט חדש עם פס התקדמות 5 שלבים (נקלט → נאסף → במעבר → במשלוח → נמסר), הגעה משוערת (ETA), מיקום אחרון, מוצא/יעד, וטיימליין של עד 10 אירועים אחרונים
- מפת קודי DHL Express לעברית (`src/lib/dhlStatusMap.ts`) — תרגום קוד 102 ושאר הקודים הנפוצים
- רענון אוטומטי ברקע: כשנפתח עמוד ההזמנות, הזמנות פעילות עם מעקב DHL שלא סונכרנו 24 שעות מתעדכנות אוטומטית. אינדיקטור התקדמות בכותרת
- Edge function חדש `track-shipments-bulk` — עיבוד עד 50 הזמנות בקריאה אחת עם concurrency=4, חוסך round-trips
- וידג'ט TCLOG נפרד שמציג את אסמכתת המשלוח
- `tracking_carrier` לזיהוי מפורש בין DHL ל-TCLOG, וכן עמודות מורחבות: `tracking_status_code`, `tracking_eta`, `tracking_last_location`, `tracking_origin`, `tracking_destination`, `tracking_events` (JSONB), `tracking_last_synced_at`, `tracking_sync_error`

### Changed
- Edge function `track-shipment` משתמש ב-`_shared/dhlParse.ts` ושומר 11 שדות (במקום 3) מתשובת DHL
- `OrderTable` משתמש ב-`<TrackingBadge>` משותף הנשען על הקוד המנורמל
- `OrdersDashboardView.handleBulkRefreshTracking` קורא ל-`track-shipments-bulk` במקום לולאה סדרתית

---

## [2026-05-01]

- Merge pull request #179 from cobra-system/claude/fix-dhl-api-error-CK9dq (743865e)
- fix(track-shipment): treat DHL 404 as "no data yet" instead of an error (bb3e0ea)

## [2026-05-01]

- Employee mobile padding + cap stock thresholds at 3000 (8635f1d)
- Mobile cards for detail-page tables, iOS safe-area, RTL polish (fb334c5)
- Additional mobile fixes from second pass audit (12b52a9)
- Fix mobile responsiveness across admin view (80920e2)

## [2026-04-30]

- Remove 'mark all closed' and 'print barcodes' buttons from lock control (bc2e9bc)
- Add unique icons for missing nav modules (d710547)

## [2026-04-30]

- feat(lock-control): printable QR PNGs, apply DB migration, fix scan crash (c20d710)
- fix(lock-control): ErrorBoundary triggered after successful scan (17e6f51)
- feat(lock-control): printable PNG QR codes + apply DB migration (3659362)

## [2026-04-30]

- fix(settings): RTL layout + collapsible permission categories (3d6225f)

## [2026-04-30]

- feat(lock-control): production polish — realtime, history, free-scan, audio (e9290c5)
- feat(lock-control): add warehouse lock barcode scanning page (b9367d9)

## [Unreleased]

### Added
- **בקרת נעילה** (`/lock-control`) — דף חדש לסריקת ברקודי QR לפתיחה וסגירה של 10 מנעולים פיזיים באתר קוברה תל אביב. כולל סרגל התקדמות לסבב פתיחה/סגירה, מעקב חי לפי משתמש וזמן, ודף הדפסה (`/lock-control/print`) עם כל ה-QR להדבקה ליד המנעולים.
- **היסטוריית בקרת נעילה** (`/lock-control/history`) — לוג מלא של סריקות עם פילטרים לפי מנעול, פעולה, משתמש וטווח תאריכים, יצוא ל-CSV.
- **סריקה חופשית** — כפתור שפותח מצלמה ומזהה אוטומטית כל מנעול לפי הברקוד שנסרק (מהיר יותר לסבב סגירה).
- **פנס במצלמה** (torch), פידבק קולי + רטט בסריקה, ועדכון בזמן אמת דרך Supabase Realtime + רענון אוטומטי כל 30 שניות.
- **הגנה מפני סריקה כפולה** — בקשת אישור על סריקה תוך 30 שניות מהאחרונה לאותו מנעול, debounce של 1.5 שניות בסריקה רציפה.
- **סימון ויזואלי "ישן"** למנעולים שלא נסרקו ב-18 השעות האחרונות.
- **כפתור "סמן הכל כסגור"** למנהלים בלבד, עם רישום כל פעולה כסריקה ידנית.
- **אינטגרציה עם `audit_log`** — כל סריקת מנעול נכתבת ללוג האודיט המאוחד.
- **בדיקות יחידה** למודול `lockControlUtils` (toggle, isStale, csvEscape).
- מודול MCP חדש `warehouse-locks` (5 כלים) למעקב סטטוס וניהול לוג הסריקות.
- טבלאות חדשות: `warehouse_locks` (סטטוס נוכחי לכל מנעול) ו-`warehouse_lock_scans` (לוג append-only).
- 10 קבצי PNG מודפסים של ברקודי QR ב-`docs/lock-qr/` + סקריפט `npm run qr:locks` להפקה מחדש (משתמש בחבילת `qrcode` עם error correction H, רוחב 600px).

## [2026-04-30]

- fix: remove undefined alertCount reference in ManagerLayout (21abe48)

## [2026-04-30]

- Move alerts page into settings notifications tab, remove nav item (de6802b)
- Remove DailyReportWidget from dashboard display (52fc759)

## [2026-04-29]

- feat: add QuantityBar battery-style stock level indicator (cf16317)

## [2026-04-29]

- fix: product deletion now succeeds and shows impact preview before confirming (acdc97a)

## [2026-04-29]

- Division page: product count KPI, create product from division, filter pickups to division products (d4b5329)

## [2026-04-27]

- Merge branch 'main' into claude/hide-technicians-bonded-Fk98e (780eea3)
- feat(scope): filter order items, not just orders, by user scope (29eeded)
- feat(auth): give division managers a curated manager UI (dd5df45)
- refactor(divisions): clean up bonded division view & extend products table (d7d2bf4)

## [2026-04-27]

- Merge pull request #167 from cobra-system/claude/fix-product-order-visibility-mHdRt (0d6d7c5)
- fix: include orders for product components in scoped user visibility (3c13f37)

## [2026-04-27]

- fix(suppliers): show product/order count columns by default, fix product count keying (2eeeeb3)

## [2026-04-27]

- Merge pull request #165 from cobra-system/claude/fix-product-order-visibility-01QX3 (a97f1ad)
- fix: include scoped orders' suppliers in product-scope visibility (90c8a41)

## [2026-04-27]

- Merge pull request #164 from cobra-system/claude/redesign-settings-page-STkBQ (9de26bb)
- refactor(settings): redesign settings page with tabbed layout (29c3f5c)

## [2026-04-26]

- Merge pull request #163 from cobra-system/claude/fix-missing-products-24mFY (3db4f2e)
- feat: add product count, order count, and website columns to suppliers table (cd6012f)
- feat: show product count instead of field qty on division cards (77b3cd8)

## [2026-04-26]

- fix(suppliers): apply missing supplier_number migration + fix error-handling (6d84a87)

## [2026-04-26]

- fix: allow custom role_definitions when creating employees + clearer DHL 401 (94dbe59)

## [2026-04-26]

- merge: resolve conflicts with main — scrollable tabs + DHL language fix (86887a5)
- feat(suppliers): add supplier_number field (68f9a3a)
- fix(dhl): remove unsupported language=he param from tracking API call (d5921cd)
- fix: remove duplicate ProcurementMeetingTab lazy import — merge artifact (02cd401)
- Merge branch 'main' of https://github.com/cobra-system/cobra-command-center into claude/procurement-meeting-tab-iDhXq (54847d6)
- fix: move procurement meeting tab to Orders page (e8944d1)

## [2026-04-26]

- merge: resolve conflict with main — keep both deleteItemConfirm and trackingLoading states (589404e)
- UI polish: dark mode, page transitions, delete confirmations, empty states, skeleton (3b3e1d7)
- fix: add mobile layouts to EquipmentPage tables (tabs 3, 4, 5) (fee4b59)
- fix: complete mobile responsiveness for remaining pages and layout (e370921)
- fix: add mobile card layouts for ReorderPage, IssuesPage, SuppliersPage (cdef09d)

## [2026-04-24]

- Merge pull request #159 from cobra-system/claude/new-session-eZGxa (a9601dd)
- fix: reload PostgREST schema cache after waste_items migration (f55bd7a)

## [2026-04-24]

- refactor: division_products as single source of truth for product-division mapping (1bbf614)
- feat: bidirectional sync between products.division and division_products (38175c4)
- fix: unify division names and rename equipment page to division management (b49f640)
- fix: replace empty string SelectItem value in EmployeeFormDialog (2fe6394)

## [2026-04-24]

### Changed
- `division_products` הוא מקור האמת היחיד לשיוך מוצרים לחטיבות
  - migration `20260424000001`: הסרת Trigger A (products → division_products) — כתיבה ישירה מהאפליקציה לא עוברת יותר דרך products.division
  - `ProductsContext.updateProduct()` ו-`addProduct()` כותבים עכשיו ישירות ל-`division_products`; Trigger B מעדכן `products.division` אוטומטית
  - migration `20260423000001`: Backfill + Trigger B נשארים בתוקף

### Added
- migration `20260423000002`: סנכרון דו-כיווני אוטומטי בין `products.division` ל-`division_products`
  - Backfill חד-פעמי: כל מוצרי החטיבות מאוכלסים אוטומטית בטבלת `division_products`
  - Trigger B (`division_products → products`): הוספה/הסרה מעדכנת `products.division` אוטומטית
- migration `20260424000001`: הסרת Trigger A — `division_products` הוא מקור האמת היחיד
- `ProductsContext.updateProduct()` ו-`addProduct()` כותבים ישירות ל-`division_products`
- מנהל חטיבה יכול להוסיף ולהסיר מוצרים מדף החטיבה שלו ללא הרשאת equipment-edit (RLS מגן ברמת DB)
- chore: resolve merge conflicts with main (5f8b984)
- feat(settings): notification settings UI — recipients, days, content toggles (9f9c2c9)
- feat(orders): overhaul dashboard with DHL tracking, payments, supplier perf & email alerts (4d43171)

## [2026-04-24] (2)

### Added
- **הגדרות התראות מייל** (`/settings` — MANAGER בלבד)
  - Toggle להפעלה/כיבוי של הדוח היומי
  - בחירת ימי שליחה (כפתורי ימי שבוע)
  - בחירת תוכן: הזמנות באיחור / תשלומים קרובים + כמה ימים קדימה
  - ניהול נמענים: הוספת משתמשי מערכת (פרופיל) + כתובות מייל חיצוניות
  - Toggle הפעל/השבת לכל נמען + אפשרות הסרה
- טבלות DB חדשות: `notification_digest_config`, `notification_recipients`
- Edge Function `notify-daily-digest` עודכן לקרוא הגדרות מה-DB, לבדוק ימי שבוע לפי שעון ישראל, ולשלוח רק לנמענים המוגדרים

## [2026-04-24]

### Added
- **לוח בקרה הזמנות — שיפורים מקיפים**
  - 4 כרטיסי KPI: הזמנות מישראל, מחו"ל, באיחור, ערך צנרת פתוחה
  - ציר הזמן מסנן הזמנות ARRIVED/CANCELLED — מציג רק הזמנות פעילות
  - עוגת סטטוס וגרף עדיפות — מחושבים על הזמנות פעילות בלבד
  - סינון ספק בסטטוס תשלום (dropdown)
  - כפתור "הצג הכל" בציר הזמן עם ספירת הזמנות
  - ווידג'ט תשלומים קרובים (30 יום) — מקובץ לפי שבוע
  - גרף תזרים תשלומים לפי חודש (6 חודשים קדימה)
  - טבלת ביצועי ספקים: % הגעה בזמן + ממוצע ימי איחור
- **DHL Tracking API**
  - Edge Function `track-shipment` — מושך סטטוס מעקב מ-DHL API
  - עמודת "מצב מעקב DHL" בטבלת הזמנות
  - סקשן מעקב DHL בדף הזמנה עם כפתור רענון
  - כפתור רענון מאסיבי בדאשבורד לכל ההזמנות עם מספר מעקב
  - Migration: עמודות `tracking_status`, `tracking_last_event`, `tracking_updated_at`
- **התראות מייל יומיות**
  - Edge Function `notify-daily-digest` — שולח סיכום יומי בעברית למנהלים
  - כולל: הזמנות באיחור + תשלומים שמגיעים תוך 3 ימים
  - GitHub Actions cron: `daily-notifications.yml` — מופעל 08:00 שעון ישראל, ימי עבודה

## [2026-04-24]

- fix(waste): fix item save error caused by multi-statement exec_sql migration (cd6949e)

## [2026-04-24]

- Merge pull request #154 from cobra-system/claude/fullscreen-popup-navigation-QOfGU (8aaaa04)
- feat: mobile UX improvements across manager layout and key pages (a2dc810)
- feat: replace mobile sidebar slide-in with fullscreen nav popup (4ec2d6f)

## [2026-04-24]

- Merge pull request #153 from cobra-system/claude/auto-update-mcp-tools-9aYpb (0f162ab)
- Add MCP tools auto-sync awareness system (f4bec4f)

## [2026-04-23]

- docs+mcp: update waste FK integration across MCP server and docs (8044d3b)
- feat(waste): real DB integration — add product_id/component_id FKs to waste_items (6def8cd)
- feat(products): show waste items on product detail page (345193e)
- feat(waste): add product-component (items) selection to wear report (640ff41)

## [2026-04-23]

### Added
- דף בלאי: אפשרות לדווח על פריטי רכיב (מ-`product_components`) בנוסף למוצרים — טוגל מוצר/פריט בטופס
- דף מוצר: סקשן **בלאי** מוצג בתיק המוצר (מתחת להזמנות) — מציג את כל פריטי הבלאי של המוצר ורכיביו, עם קישור לדף הבלאי

### Changed
- אינטגרציית DB אמיתית לטבלת `waste_items`: הוספת עמודות FK — `product_id → products(id)` ו-`component_id → product_components(id)` — עם indexes ו-backfill אוטומטי לרשומות קיימות (מיגרציה 93)
- בחירת מוצר/רכיב בדף הבלאי מעדכנת כעת את ה-FK בנוסף לטקסט החופשי
- `markItemAsFaulty` שומר `product_id` בשורת הבלאי שנוצרת מהחזרת ציוד
- MCP `waste.ts`: `list_waste_items` תומך כעת בסינון לפי `product_id` (כולל רכיבים); `create_waste_item` ו-`update_waste_item` מקבלים `product_id` ו-`component_id`

### Fixed
- תיקון שמות חטיבות — `AppContext.divisions` מסונכרן כעת עם `DIVISIONS` מ-`equipment/constants.ts` (AWACS, DOORE, פריזבי קרסו במקום AWCAS/Doore/קראסו)
- עדכון נתוני mock לפי שמות החטיבות הנכונים
- שינוי הגדרת מודול `/equipment`: כותרת הדף ותווית המודול עודכנו ל"ניהול חטיבות"
- עדכון README — שורת `/equipment` בטבלת המודולים
- chore: resolve merge conflicts with main (fbfaab5)
- fix(mcp): tighten task tools — Hebrew priority enum, status validation, assignee lookup (8488538)
- fix: sync product deletion fix to MCP tool, add component search to GlobalSearch (ad60654)
- docs: add component detail route to README modules table (b26ffc4)
- fix: remove linked-products section, fix product deletion, add component profile page (e678c4d)

## [2026-04-23]

### Changed
- הסרת סעיף "מוצרים מקושרים לחטיבה (קטלוג)" מדף החטיבה — מוצרי החטיבה מנוהלים כולם דרך טבלת `division_products` בלבד

### Fixed
- תיקון מחיקת מוצר שנכשלה בשקט כשהמוצר קשור להזמנות (FK RESTRICT על `order_items`)
- כלי MCP `delete_product`: אותו תיקון (nullify order_items לפני מחיקה)
- כלי MCP משימות: עדיפות P0-P3 הוחלפה בעברית (דחוף/גבוה/בינוני/נמוך), ולידציה על status ו-assignee מול profiles

### Added
- דף תיק פריט (`/products/:productId/components/:componentId`) — תיק מפורט לכל רכיב/פריט בתוך מוצר מורכב, עם עריכה ומחיקה
- ניווט לתיק פריט ישירות מטבלת ה-BOM בתיק המוצר
- חיפוש גלובלי: הוסיפו חיפוש על פריטים/רכיבים עם ניווט ישיר לתיק פריט

- feat: extend search to cover all meaningful fields across pages (d616469)
- fix: apply document_tracking migration and sync TS types for purchase_documents (b36f6f9)

## [2026-04-20]

- Merge pull request #149 from cobra-system/claude/fix-consumption-average-pwunu (2d1714a)
- Add MCP tools: assign_product_division, get_product_supplier_payments, list_orders_by_division (836b283)
- Add supplier payment stats to product detail + auto-assign order division (ab65b30)
- Implement division-based data filtering with RLS enforcement (07a9803)
- Fix consumption average + division improvements (34db6b5)

## [2026-04-20]

- Implement order archiving, dashboard status distribution, and image uploads (1b7d588)

## [2026-04-20]

- Update product field labels and visibility (49536b2)

## [2026-04-19]

- Merge main and resolve MIGRATIONS.md conflict (cc13d3e)
- Integrate inventory as native part of divisions management (b1576f2)
- Move inventory page under equipment/divisions management (d9b625c)

## [2026-04-19]

- Merge pull request #145 from cobra-system/claude/organize-product-data-Dmzkc (2662a0c)
- fix(mcp): remove computed fields from product write tools (d98e9a4)
- feat(products): add field tooltips and distinguish computed vs editable data (8556a9f)

## [2026-04-19]

- Merge pull request #143 from cobra-system/claude/remove-dashboard-widgets-MDzes (3bc7f2a)
- Remove active-workflows banner and inventory/severity charts from dashboard (7a69e66)

## [2026-04-19]

- feat(waste): add photo capture to waste management page (826dc7f)
- feat(wear): add photo capture to wear control inspection (1d577cf)

## [2026-04-19]

- feat(mcp): update existing tools to cover recent schema changes (bb5954a)
- feat(mcp): add MCP tools for division_products, warehouse zones, and waste_items (5833b6a)

## [2026-04-18]

- feat(products): rename 'בדרך'→'עול"ב', make incoming/sales computed read-only (aa6b9cc)
- feat: division manager profiles + division product intelligence table (cb26e4c)
- fix: RTL equipment page + edit/delete for installers, pickups, returns (b7a58af)

## [Unreleased]

### Added
- Division manager profiles: `division` field on `profiles` links a user account to a specific division; managers auto-redirect to their division page on login and cannot access other divisions via URL
- Division select field in Settings user management (create/edit employee)
- Division product intelligence table in each division detail page: tracks field stock (manually updated), monthly consumption (auto-computed from pickup history), quarterly demand (manually set), and last change date
- `division_products` DB table with per-division product entries and RLS policies

### Fixed
- RTL layout across all equipment page tabs (tabs order, chevron directions, navigation icons)
- Dialog RTL direction now explicit (not relying on inherited CSS)

### Added (previous release)
- Edit and delete for technicians (installers) in division detail page
- Full edit of pickup items via dialog (products linked via Combobox)
- Delete pickup with cascade
- Returns section in division detail page with edit/delete
- Visual grouping of sales divisions vs bonded divisions on equipment overview

---

## [2026-04-17]

- feat: add procurement MCP tools and fix meeting order bugs (c6bd0be)

## [2026-04-16] — כלי MCP לרכש ומלאי

### Added
- **`get_product_inventory_full`**: מלאי מלא למוצר — מלאי לפי מרכז, הזמנות בדרך, צריכה חודשית (6 חודשים), ימי runway, והמלצת הזמנה חוזרת.
- **`get_reorder_dashboard`**: לוח מחוונים רוחבי — כל המוצרים ממוינים לפי דחיפות (critical/high/medium/low), עם כמות מוצעת ושיטת משלוח.
- **`import_stock_snapshot`**: ייבוא מלאי מ-SAP — UPSERT לפי SKU + שם מרכז לטבלת `center_inventory`.
- **`get_meeting_summary`**: סיכום ישיבה מלא בקריאה אחת — מאושר/נדחה, סכומים, פרטי בנק. מחליף 10+ קריאות.
- **`bulk_update_meeting_decisions`**: עדכון החלטות מרובות בישיבה בבת אחת.
- **`get_supplier_bank_details`**: פרטי בנק לספק מתוך טבלת `supplier_bank_details`.
- **`sync_email_to_order`**: סנכרון אימייל להזמנה — append חכם לנוטס + עדכון שדות shipping.
- **`get_order_timeline`**: ציר זמן מלא להזמנה — יצירה, תשלומים, ישיבות, מסמכים, שינויי הערות.
- **Migration `20260416000000_supplier_bank_details`**: טבלת `supplier_bank_details` עם נתוני seed לספקים ידועים.

### Fixed
- **`get_meeting_orders`**: תוקנה שגיאה `column orders_1.currency does not exist` — הוסרה עמודת `currency` מה-select.
- **`update_order`**: נוסף פרמטר `supplier_id` לאפשר שינוי ספק בהזמנה קיימת.
- **UI ישיבת רכש — הצגת סכומים**: `AgendaOrderRow` מציג כעת `approved_amount` → סכום ממתין → `total_price` (fallback) במקום תמיד `total_price`.

## [2026-04-16]

- Show payment totals grouped by due date in procurement agenda (8cce188)

## [2026-04-14]

- Merge pull request #138 from cobra-system/claude/fix-schema-cache-column-WVTcd (04df9f7)
- fix: re-assert center_id column on installers to resolve schema cache error (0caa07b)

## [2026-04-14]

- Merge pull request #137 from cobra-system/claude/add-purchase-agenda-FT9XO (68d3b40)
- Fix fetchKpis to not hang spinner on network failure (ab5d461)
- Rebuild ProcurementMeetingTab from scratch (81f2810)
- Add purchase agenda tab rebuild with column visibility (7c9cf2d)

## [2026-04-14] — ישיבת רכש אינטראקטיבית

### Added
- **טאב "סדר יום רכש" — ניהול ישיבת רכש אינטראקטיבי**: הטאב מציג כעת את `ProcurementMeetingTab` — ממשק בחירת הזמנות לישיבה, תיעוד החלטות (אושר / נדחה / חלקי / ממתין), מעקב אחרי סכום מאושר לתשלום, וסגירת ישיבה. המשתמש בוחר בעצמו אילו הזמנות נכנסות לדיון.
- **בחירה אוטומטית של ישיבה פתוחה**: בטעינת הטאב תיבחר אוטומטית הישיבה הפתוחה האחרונה אם קיימת.
- **כלי MCP חדש `get_pending_orders_for_meeting`**: מחזיר הזמנות ממתינות לדיון — קבוצה א׳ עם תשלומים ממתינים, קבוצה ב׳ עם PI ללא לוח תשלומים. תומך בסינון לפי `meeting_id` להחרגת הזמנות שכבר נוספו לישיבה. מאפשר ל-Claude לענות על "מה יש לנו בקנה".

---

## [2026-04-14]

- fix: schema cache error, division page load, pickup edit, RTL, day-view tracking, column visibility (ffd513f)

## [2026-04-14]

- fix: correct all recurring task logic bugs (9ba306d)

## [2026-04-14]

- chore: merge main into fix-recurring-tasks branch (09d38da)
- chore: merge main into fix-recurring-tasks branch (f9e5559)
- fix: restore recurring task columns and implement full recurring lifecycle (8454205)

## [2026-04-14]

### Fixed
- תיקון שגיאת "Could not find the 'day_of_month' column of 'tasks' in the schema cache" — עמודות המשימות החוזרות לא הוחלו על הדאטאבייס החי. מיגרציה חדשה (`20260414000001`) מוסיפה אותן ומרפרשת את ה-PostgREST schema cache.

### Added
- **משימה חוזרת — יצירת המופע הבא ברגע הסימון כבוצע**: כאשר מסמנים מופע של משימה חוזרת כ"בוצע", המופע הבא נוצר מיידית בתאריך הרלוונטי (יום מחר / שבוע / חודש הבא בהתאם לתדירות).
- **משימה חוזרת שלא בוצעה — העברה עם הערה**: כאשר `advance-overdue-tasks` מעביר מופע של משימה חוזרת שלא בוצע ביומה, מתווספת הערה "⚠️ לא בוצע ב-[תאריך]" ומתעדכן `last_generated` בתבנית כדי למנוע כפילות.

### Fixed (טכני)
- תיקון חוסר התאמה בין ערך `"yearly"` בטופס יצירת משימה לבין `"annual"` שמצפים לו מנוע החזרה (`generate-recurring-tasks`, `recurringUtils.ts`).

---
- Merge pull request #134 from cobra-system/claude/fix-product-data-sync-IpgCh (5e58d98)
- fix: live product metrics on detail page, narrow 'בדרך' statuses, add optional table columns (b0f93b7)

## [2026-04-14]

- Merge pull request #133 from cobra-system/claude/fix-product-assignment-5y8vD (95d97b7)
- fix: open CORS to * and surface profile-update errors in manage-employee (ce161ef)

## [2026-04-14]

- Merge pull request #131 from cobra-system/claude/mobile-products-page-YYOju (7a259f4)
- Make Products page and related components mobile-responsive (a10fb26)

## [2026-04-14]

- feat: smart live routing for בדרך and מחיר רכישה in ProductsPage (3ee8970)

## [2026-04-13]

- chore: merge main + resolve CHANGELOG conflict (b4644c1)
- feat: technician profile enhancements + bonded division support (b125eb1)
- feat: redesign equipment page with division cards and detail page (3a52dbc)

## [2026-04-13]

### Added
- עמוד פרטי חטיבה (`/equipment/division/:divisionName`) — טכנאים, הצטיידויות, מלאי שטח, אנשי קשר עם CRUD
- 6 כרטיסי סיכום חטיבה בטאב "חטיבות" עם ניווט לעמוד הפרטים
- קובץ `constants.ts` עם DIVISIONS, DIVISION_COLORS ו-BONDED_DIVISIONS לכל 6 החטיבות
- תמיכה בישויות מסחריות (bonded): פרופיל ישות בתיק החטיבה, עמוד מתקין עם תג "ישות מסחרית"
- תיק מתקין: KPI רביעי "בשטח כעת", טבלת "מלאי שטח" לפי מוצר עם column visibility

### Changed
- עמוד הצטיידות (`/equipment`) עוצב מחדש: RTL, טאב חטיבות עם כרטיסים, טאבים 2-3 מקובצים לפי חטיבה, column visibility + מיון לכל טבלה
- לוח בקרה (טאב 4) — תרשימי RTL, טבלת סיכום חטיבות קליקבילית

- feat: add photo capture for products and BOM components (589661a)


## [2026-04-13]

- Merge pull request #127 from cobra-system/claude/procurement-meeting-tab-iDhXq (a8bb104)
- feat: procurement meeting tab with order selection and decision tracking (f71ba11)

## [2026-04-13]

- Merge pull request #122 from cobra-system/claude/edit-logistics-squares-QGGND (be8dc80)
- feat(logistics-map): zone notes, change log, keyboard shortcuts, reorder, product transfer (5cec58c)
- feat(logistics-map): heatmap, drag-drop, capacity, picking list, print (56aef99)
- chore: merge main — keep both migration 8 (products perms) and migration 9 (warehouse_zones) (a58c9ea)
- feat(logistics-map): editable zones, new zone creation, fix product add bug (8d000f6)

## [2026-04-13]

- fix: save annotated document as new record instead of overwriting original (0527566)

## [2026-04-12]

- Merge pull request #125 from cobra-system/claude/issue-detail-page-9GJKX (020abaf)
- docs: add /issues/:id route to README modules table (03e8ebf)
- feat: add issue detail page with inline editing, updates timeline, and media gallery (ca4f4b2)

## [2026-04-12] — Issue Detail Page

### Added
- עמוד פרטי תקלה (`/issues/:id`) — צפייה ועריכה inline של תיאור, חומרה, סטטוס, פתרון ופרטי מטה-דאטה
- ציר זמן עדכונים/תגובות לכל תקלה (הוספה ומחיקה למנהל)
- גלריית מדיה: תמונות + וידאו עד 50MB, lightbox לתמונות, הפעלה בחלון חדש לוידאו
- לחיצה על שורה בטבלת התקלות מנווטת לעמוד הפרטים במקום לעמוד המוצר
- טבלות DB חדשות: `issue_updates`, `issue_attachments` עם RLS; bucket `issue-media` ב-Supabase Storage

## [2026-04-12]

- Merge pull request #124 from cobra-system/claude/fix-product-migration-issues-eZSYh (e567ee8)
- Fix product migration function dependency and improve error handling (85a9486)

## [2026-04-12]

- refactor: reorganize role permissions UI to vertical layout (2e31e0a)

## [2026-04-12]

- Merge pull request #121 from cobra-system/claude/fix-manager-edit-permissions-JkYDl (d99e0e8)
- fix: allow non-manager users with edit permission to modify products (bd71bd5)

## [2026-04-12]

- Merge pull request #120 from cobra-system/claude/improve-error-page-mt0oW (fd52c57)
- Add 5 MCP tools for issue management (1f1e9ab)
- Improve IssuesPage to professional level (223e373)

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

