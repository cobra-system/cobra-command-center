# CHANGELOG

כל השינויים המשמעותיים במערכת COBRA Command Center מתועדים כאן.
פורמט מבוסס על [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-04-27]

- Merge pull request #164 from cobra-system/claude/redesign-settings-page-STkBQ (9de26bb)
- refactor(settings): redesign settings page with tabbed layout (29c3f5c)

<!-- last-commit: 9de26bb77775750caf79638d7bfa18ca3632ae35 -->
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

