# Performance Baseline — 2026-05

מדידות מקור לפני יישום שיפורי הביצועים שמתוארים ב-`/root/.claude/plans/woolly-doodling-firefly.md`. הערכים פה הופכים ל-acceptance gates של Phase 3.

נמדד על branch `claude/define-performance-improvements-ROsOd` ב-2026-05-12.

---

## 1. Production build (`npm run build`)

- Build time: **32.93s** (vite + SWC)
- Total `dist/`: **8.2 MB** (raw), `dist/assets/` 8.0 MB
- Total JS (gzipped): **~1.81 MB**
- CSS: 1 file, 116 KB raw (`index-BSQxj-s2.css`)

### Top 10 biggest JS chunks (raw / gzipped)

| Chunk | Raw | Gzipped |
|---|---:|---:|
| `DocumentAnnotationEditor` | 1,627 KB | 554 KB |
| `DocumentDetailPage` | 1,522 KB | 424 KB |
| `LogisticsMapPage` | 772 KB | 145 KB |
| `index` (main entry) | 698 KB | 205 KB |
| `BarChart` (recharts) | 374 KB | 103 KB |
| `LockControlPage` | 356 KB | 106 KB |
| `OrdersPage` | 97 KB | 27 KB |
| `DivisionDetailPage` | 90 KB | 20 KB |
| `TasksPage` | 84 KB | 21 KB |
| `WasteManagementPage` | 57 KB | 15 KB |

**הערה:** Vite מזהיר על מספר chunks מעל 500KB. אין `manualChunks` ב-`vite.config.ts`, לכן `recharts`, `pdfjs-dist`, `pdf-lib`, `mammoth`, `fabric`, `html2pdf.js` נדבקים ל-page chunks שמייבאים אותם.

### דגלי build הראויים לתשומת לב
- אין `build.sourcemap: "hidden"` — sourcemaps מועלים ללקוח.
- אין `build.rollupOptions.output.manualChunks`.
- `index-CYM1Woff.js` (entry) = 698KB/205KB gzip — כולל React, react-query, supabase-js, @radix-ui/*, sentry. כל אלה מועמדים לפיצול ל-vendor chunks (Phase 2.6).

---

## 2. Database size context (Supabase)

Project: `operations-system` (`ljpdwezgahrrffnwajho`), Postgres 17.6.1.

טבלאות עם 25+ שורות (top 25):

| Table | Rows | Total size |
|---|---:|---:|
| `frisbee_inspection_equipment` | 39,320 | 7,424 KB |
| `frisbee_inspections` | 3,950 | 3,432 KB |
| `tasks` | 450 | 336 KB |
| `products` | 236 | 144 KB |
| `purchase_documents` | 228 | 160 KB |
| `order_notes_history` | 175 | 152 KB |
| `order_items` | 167 | 80 KB |
| `equipment_pickup_items` | 153 | 64 KB |
| `warehouse_zone_log` | 126 | 176 KB |
| `division_products` | 87 | 80 KB |
| `orders` | 80 | 184 KB |
| `order_payments` | 78 | 112 KB |
| `suppliers` | 74 | 64 KB |

**מסקנה חשובה:** למעט `frisbee_*` (39k+4k שורות), ה-DB עדיין קטן. שאילתות מהירות מאליהן (כי seq scan על 80 שורות זה זול). שיפורי האינדקס מהתכנית **מונעים** רגרסיה כשה-DB יגדל, אבל לא יראו win בולט כיום ב-EXPLAIN.

ה-FrisbeeDashboard (לפי CLAUDE.md) שואל את `frisbee_inspection_equipment` ו-`frisbee_inspections` — שתי הטבלאות הגדולות. שווה למדוד שאילתות שלו בעתיד.

---

## 3. EXPLAIN ANALYZE — שאילתות חמות

כולן רצו על המסד החי, עם הקאש החם.

### Q1 — Orders by status + created_at (Dashboard / OrdersPage)
```sql
SELECT id, pi_number, status, created_at, supplier_id
FROM orders WHERE status = 'ON_THE_WAY' ORDER BY created_at DESC LIMIT 50;
```
- Plan: **Seq Scan on orders** → Sort
- Buffers: shared hit=10
- Planning: 30.3 ms · **Execution: 11.3 ms**
- ❌ אין אינדקס על `(status, created_at)`. עם 80 שורות עוד לא בעיה, אבל planning time גבוה.

### Q2 — Tasks by status + created_at (Dashboard)
```sql
SELECT id, title, status, created_at, assignee_id, priority
FROM tasks WHERE status != 'DONE' ORDER BY created_at DESC LIMIT 50;
```
- Plan: **Seq Scan on tasks** → Sort (36 rows קלאסיפיים מתוך 450)
- Buffers: shared hit=26
- Planning: 8.2 ms · **Execution: 14.8 ms**
- ❌ אין אינדקס על `(status, created_at)`. גם `assignee_id` חסר (התכנית התבססה על הנחה שגויה — אומת).

### Q3 — Products by category + name (ProductsPage)
```sql
SELECT id, name, sku, category
FROM products WHERE category = 'FRISBEE' ORDER BY name LIMIT 100;
```
- Plan: **Seq Scan on products** → Sort (0 שורות תאמו)
- Planning: 7.6 ms · **Execution: 9.7 ms**
- ❌ אין אינדקס על `category` או `(category, name)`.

### Q4 — Orders ilike search (MCP / OrderTable filter)
```sql
SELECT id, pi_number, notes FROM orders
WHERE notes ILIKE '%test%' OR pi_number ILIKE '%test%' LIMIT 50;
```
- Plan: **Seq Scan on orders**
- Planning: 4.9 ms · **Execution: 0.5 ms** (זול עם 80 שורות)
- ❌ אין GIN trigram על `notes` / `pi_number`. ברגע שהטבלה תגדל ל-10k+ זה יזחל.

### Q5 — Products ilike search
```sql
SELECT id, name, sku FROM products
WHERE name ILIKE '%test%' OR sku ILIKE '%test%' LIMIT 50;
```
- Plan: **Seq Scan on products**
- Planning: 0.76 ms · **Execution: 0.73 ms**
- ❌ אין GIN trigram על `name` / `sku`.

---

## 4. אינדקסים קיימים — טבלאות חמות

```
orders:             pkey, idx_orders_shipment_group_id, idx_orders_tracking_sync (partial), orders_division_idx
tasks:              pkey, idx_tasks_depends_on (gin)
products:           pkey, products_sku_key (unique)
order_items:        pkey
order_payments:     pkey, idx_order_payments_due_date, idx_order_payments_order_id, idx_order_payments_status
product_issues:     pkey
```

חסרים בולטים:
- `orders (status, created_at desc)` — נדרש ל-Dashboard ו-OrdersPage.
- `tasks (status, created_at desc)` ו-`tasks (assignee_id)` — נדרש ל-Dashboard ו-MyTasks.
- `products (category)` ו-`products (category, name)` — נדרש ל-ProductsPage.
- `product_issues (status)`, `product_issues (product_id)` — חסר לחלוטין.
- GIN trigram על `orders.notes`, `orders.pi_number`, `products.name`, `products.sku` — לכל חיפושי ilike.

---

## 5. RLS helper functions

```
is_manager()  — STABLE, body: SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGER')
has_role()    — STABLE, body: SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
```

הפונקציות עצמן STABLE (טוב), אבל הקריאה אליהן ב-policies לא עטופה ב-`(select ...)` — לכן Postgres קורא אותן per row ולא per statement. זה ה-fix של Phase 2.3.

---

## 6. Lighthouse — דף הלוגין (ניתן לריצה ללא auth)

נמדד אוטומטית מול `vite preview` על Chromium headless. דפי המערכת המאומתים (Dashboard/Orders/Products) דורשים credentials של משתמש בדיקה — לא רץ אוטומטית כדי לא ליצור משתמש פיקטיבי ב-DB של ייצור.

### Login — Desktop preset
| Metric | ערך |
|---|---|
| Performance score | **1.00** |
| FCP | 0.5 s |
| LCP | 0.6 s |
| TBT | 0 ms |
| CLS | 0.004 |
| Speed Index | 0.5 s |
| TTI | 0.6 s |
| Script bootup | 0.1 s |
| Main thread work | 0.3 s |
| Unused JS estimate | 110 KiB |
| Total transferred | 251 KiB |

### Login — Mobile preset (Slow 4G simulated)
| Metric | ערך |
|---|---|
| Performance score | **0.96** |
| FCP | 2.1 s |
| LCP | 2.3 s |
| TBT | 90 ms |
| CLS | 0 |
| Speed Index | 2.1 s |
| Script bootup | 0.4 s |
| Main thread work | 1.1 s |
| Unused JS estimate | 110 KiB |
| Render-blocking savings | ~300 ms |
| Total transferred | 251 KiB |

**הערה:** דף הלוגין כבר מהיר (LoginPage eager-loaded הוא 17 KB gzipped בלבד; שאר המסכים lazy). השיפורים בתכנית ישפיעו על דפים מאומתים, לא על הלוגין עצמו. ה-render-blocking של 300ms ב-mobile מגיע מ-Google Fonts (Heebo) ו-CSS bundle.

## 7. Playwright trace — קר על `/` (localhost, no throttling)

מדידות Performance API:

| Metric | ערך |
|---|---|
| Navigation time | 1,193 ms |
| First Paint | 44 ms |
| First Contentful Paint | 144 ms |
| DOMContentLoaded | 86 ms |
| Load event | 87 ms |
| Resources fetched | 29 |
| Total encoded bytes | 265 KB |
| Total decoded bytes | 841 KB |
| JS Heap used (לאחר settle) | 5.6 MB |
| JS Heap total | 7.8 MB |

## 8. Bundle vendor breakdown (rollup-plugin-visualizer)

Top vendors לפי gzip (סך 3.29 MB כולל duplication בין chunks):

| Vendor | GZ KB | RAW KB | Files | הערה |
|---|---:|---:|---:|---|
| **lucide-react** | 469 | 771 | 1,547 | 148 קבצים מייבאים icons. כל icon ~3KB; שווה לבדוק tree-shaking או manual chunk |
| **html2pdf.js** | 343 | 1,523 | 2 | מונוליטי; dynamic import חיוני |
| src/components | 263 | 1,145 | 132 | קוד היישום |
| **html5-qrcode** | 222 | 1,190 | 16 | dynamic-import בלחיצה הראשונה |
| **xlsx** | 217 | 860 | 1 | **לא היה בתכנית** — להוסיף לרשימת dynamic-import |
| **pdf-lib** | 165 | 712 | 126 | dynamic-import בעורך מסמכים |
| **pdfjs-dist** | 159 | 780 | 1 | dynamic-import בעורך מסמכים |
| **recharts** | 157 | 567 | 70 | React.lazy לתת-עץ הצ׳ארטים |
| src/pages | 135 | 748 | 29 | קוד היישום |
| @pdf-lib/standard-fonts | 97 | 131 | 18 | נכלל ב-pdf-lib |
| **fabric** | 83 | 280 | 1 | dynamic-import ב-DocumentAnnotationEditor |
| date-fns | 81 | 242 | 131 | יחסית סביר |
| lodash | 75 | 151 | 195 | transitive (לא משימוש ישיר באפליקציה — מ-html2pdf/pdfjs) |
| html2canvas | 73 | 446 | 2 | תלות transitive של html2pdf |
| pako | 61 | 214 | 23 | זיפ — transitive |
| @supabase/auth-js | 49 | 238 | 16 | בליבת supabase |
| bluebird | 44 | 176 | 38 | transitive — לבדוק מי מביא |
| react-dom | 42 | 130 | 5 | core |

**מי שמשתמש ב-xlsx**: `src/components/documents/BulkActionsBar.tsx`, `src/pages/DocumentDetailPage.tsx` — שניהם מועמדים מצוינים ל-dynamic-import בתוך handler.

## 9. מה לא נמדד אוטומטית

| מדידה | מה חסר |
|---|---|
| Lighthouse על Dashboard/Orders/Products/Issues/DocumentDetail | דורש משתמש בדיקה (לא יצרתי כזה ב-DB של ייצור) |
| React DevTools Profiler — typing in ProductsPage, sort OrderTable | אינטראקטיבי בלבד |
| RLS overhead per-row למשתמש non-manager | דורש משתמש בדיקה |
| DataLoader Tier total post-login | דורש משתמש בדיקה |

ניתן להריץ אחרי שיהיה credentials של משתמש בדיקה: לסקריפט Playwright להוסיף `page.fill('input[type=email]', '...')` ו-`page.fill('input[type=password]', '...')`, ואז `npx lighthouse` עם `--extra-headers='{"Cookie":"..."}'` או `--save-assets`.

---

## 10. תרגום ה-baseline ל-acceptance gates של Phase 3

| Metric | Baseline | Target |
|---|---|---|
| Total JS gzipped (dist/assets) | 1.81 MB | ≤ 1.10 MB (60%) |
| Main entry `index-*.js` gzipped | 205 KB | ≤ 100 KB |
| `DocumentDetailPage` chunk gzipped | 424 KB | מקובל אם dynamic-imported behind handler |
| `DocumentAnnotationEditor` gzipped | 554 KB | מקובל אם behind route + dynamic import |
| Login mobile LCP (Slow 4G simulated) | 2.3 s | < 2.0 s |
| Login mobile TBT | 90 ms | < 50 ms |
| Login mobile render-blocking savings | 300 ms | < 50 ms (fonts + CSS) |
| `lucide-react` gz contribution | 469 KB | ≤ 200 KB (manual chunk + audit unused icons) |
| `xlsx` gz contribution (not in initial chunk) | 217 KB | 0 KB ב-initial (dynamic-imported) |
| `html2pdf.js` gz contribution (not in initial chunk) | 343 KB | 0 KB ב-initial |
| EXPLAIN Q1 (orders status+created) | Seq Scan, 11 ms | Index Scan, < 5 ms |
| EXPLAIN Q3 (products category+name) | Seq Scan, 10 ms | Index Scan, < 5 ms |
| EXPLAIN Q4 (orders notes ilike) | Seq Scan, 0.5 ms (טבלה קטנה) | GIN trigram scan; שמירה < 20 ms גם עם 10x נתונים |
| RLS overhead למשתמש non-manager על orders list | _TBD_ (דורש משתמש בדיקה) | ≤ 10% מזמן השאילתה הכולל |
| Lighthouse LCP mobile (Dashboard) | _TBD_ (דורש auth) | < 2.5s |
| Lighthouse TTI mobile (Dashboard) | _TBD_ (דורש auth) | < 3.5s |
| ProductsPage typing commit | _TBD_ (אינטראקטיבי) | < 16ms |

---

## 11. סיכום וההמלצה לגבי סדר ביצוע

המדידות מאשרות את ההיפותזה של התכנית, ועוד מגלות 3 פריטים שלא היו במקור:

**ממצאים חדשים שכדאי לכלול:**
1. **`lucide-react` 469 KB gz** — הכי גדול בכל ה-bundle. 148 קבצים מייבאים ממנו. שווה לבדוק אם tree-shaking עובד; אם לא — לעבור לייבוא per-icon (`lucide-react/dist/esm/icons/x`) או manual-chunk.
2. **`xlsx` 217 KB gz** — לא היה ברשימת dynamic-import המקורית. רק 2 קבצים משתמשים (`BulkActionsBar.tsx`, `DocumentDetailPage.tsx`) — קל להפוך ל-`await import()` בתוך handler.
3. **300ms render-blocking על mobile** — Google Fonts + CSS bundle. שווה לשקול `font-display: swap` או הזרמה inline של critical CSS.

**עדיפויות לפי ROI על ה-DB הקיים** (80-450 שורות בטבלאות חמות):

1. **Dynamic-import של DocumentDetailPage + DocumentAnnotationEditor + xlsx + html5-qrcode** — מסירים ~1.4 MB gz מ-bundle הראשוני (Phase 1.2 מורחב).
2. **`manualChunks` ב-vite** — מקטין את ה-`index-*.js` (205 KB) פי 2 (Phase 2.6).
3. **Debounce + memo row + virtualization על FrisbeeDashboard** — הטבלה החיה היחידה עם 39k שורות (Phase 1.1+1.3+2.1).
4. **אופטימיזציית `is_manager()` ב-RLS** — נותנת win מיידי גם עם DB קטן (Phase 2.3).

**preventive (לעתיד):** האינדקסים החדשים והגרסיון של GIN trigram (Phase 2.2) — לא יראו win מיידי ב-EXPLAIN על הנתונים הנוכחיים, אבל מונעים רגרסיה כשטבלאות יגדלו.

**שלא נמדד:** דפים מאומתים (Dashboard, Orders, Products) דורשים credentials של משתמש בדיקה. אם תיתן credentials בעתיד, ניתן להריץ Lighthouse עליהם ולמלא את ה-_TBD_ הנותרים.
