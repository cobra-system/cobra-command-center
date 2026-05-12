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

## 6. מדידות שלא בוצעו אוטומטית

הפריטים הבאים מ-Phase 0 דורשים הרצה ידנית (דפדפן/UI) ולא ניתן להריץ אותם ב-CI:

| מדידה | איך להריץ | איפה לתעד |
|---|---|---|
| Lighthouse (mobile, Fast 3G) על Dashboard/Orders/Products/Issues/DocumentDetail | Chrome DevTools → Lighthouse | לעדכן טבלה כאן בעמודה "Baseline" |
| React DevTools Profiler — Products search, OrderTable sort, Dashboard cold | React DevTools → Profiler | לעדכן טבלה כאן |
| Network HAR של OrdersPage קרה | Chrome DevTools → Network → Save HAR | לעדכן טבלה כאן |
| `console.time` סביב DataLoader (`src/contexts/AppContext.tsx:90-105`) | להוסיף קצרות, להריץ, להסיר | לעדכן טבלה כאן |

טבלת baseline למילוי ידני:

| Metric | Route / Scenario | Baseline |
|---|---|---|
| Lighthouse LCP (mobile, Fast 3G) | / (Dashboard) | _TBD_ |
| Lighthouse LCP | /orders | _TBD_ |
| Lighthouse LCP | /products | _TBD_ |
| Lighthouse TTI | / | _TBD_ |
| Lighthouse TBT | / | _TBD_ |
| Profiler longest commit | ProductsPage typing 1 char | _TBD_ |
| Profiler commit count | OrderTable column sort | _TBD_ |
| Network HAR — request count | /orders cold | _TBD_ |
| Network HAR — total payload | /orders cold | _TBD_ |
| DataLoader Tier total | post-login | _TBD_ |

---

## 7. תרגום ה-baseline ל-acceptance gates של Phase 3

| Metric | Baseline | Target |
|---|---|---|
| Total JS gzipped | 1.81 MB | ≤ 1.10 MB (60%) |
| Main entry `index-*.js` gzipped | 205 KB | ≤ 100 KB |
| `DocumentDetailPage` chunk gzipped (לא חוסם initial) | 424 KB | מקובל אם dynamic-imported behind handler |
| `DocumentAnnotationEditor` gzipped (לא חוסם initial) | 554 KB | מקובל אם behind route + dynamic import |
| EXPLAIN Q1 (orders status+created) | Seq Scan, 11 ms | Index Scan, < 5 ms |
| EXPLAIN Q3 (products category+name) | Seq Scan, 10 ms | Index Scan, < 5 ms |
| EXPLAIN Q4 (orders notes ilike) | Seq Scan, 0.5 ms (טבלה קטנה) | GIN trigram scan; שמירה < 20 ms גם עם 10x נתונים |
| RLS overhead למשתמש non-manager על orders list | _TBD_ (לא נמדד עוד) | ≤ 10% מזמן השאילתה הכולל |
| Lighthouse LCP mobile (Dashboard) | _TBD_ | < 2.5s |
| Lighthouse TTI mobile (Dashboard) | _TBD_ | < 3.5s |
| ProductsPage typing commit | _TBD_ | < 16ms |

---

## 8. סיכום וההמלצה לגבי סדר ביצוע

הנקודות עם ההחזר הגבוה ביותר על ה-DB **הקיים** (80-450 שורות בטבלאות חמות) הן בצד הפרונט:

1. **Dynamic-import של `DocumentDetailPage` ו-`DocumentAnnotationEditor`** — מסירות 978 KB גזיפ מאיתחול הניווט.
2. **`manualChunks` להפרדת recharts/pdf/radix/supabase/sentry** ב-vite — מקטין את ה-main entry.
3. **Debounce + memo row + virtualization** — שיפור משמעותי ב-UX של דפי טבלה גדולים (במיוחד `FrisbeeDashboard` שניגש ל-39k שורות).

האינדקסים החדשים ו-GIN trigram (Phase 2.2) הם **מניעה לעתיד** — שווה לבצע, אבל לא יראו win מיידי ב-EXPLAIN עד שהטבלאות יגדלו.

האופטימיזציה של `is_manager()` ב-RLS (Phase 2.3) **תיתן win מיידי** למשתמשי non-manager כי הסאב-סלקט נקרא לכל שורה בכל שאילתה — שווה לבצע גם עם DB קטן.

עדכן את ה-_TBD_ הידניים אחרי הרצת Lighthouse/Profiler לפני שמתחילים את Phase 1.
