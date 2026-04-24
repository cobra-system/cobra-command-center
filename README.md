# COBRA Command Center 🐍

מערכת ניהול עסקי מלאה לייבוא, מלאי, ספקים, הזמנות ומשימות — בנויה עם React + Supabase.

---

## תוכן עניינים

- [תיאור המערכת](#תיאור-המערכת)
- [מודולים](#מודולים)
- [תפקידי משתמשים](#תפקידי-משתמשים)
- [מסד נתונים](#מסד-נתונים)
- [טכנולוגיות](#טכנולוגיות)
- [התקנה והרצה](#התקנה-והרצה)
- [מבנה תיקיות](#מבנה-תיקיות)

---

## תיאור המערכת

COBRA Command Center היא מערכת ERP קלה לעסקי ייבוא. היא מאפשרת:

- ניהול **מוצרים** וקומפוננטים
- מעקב **הזמנות רכש** מספקים בחו"ל
- ניהול **ספקים** ואנשי קשר
- ניהול **משימות** צוות עם לוח קנבן ותצוגה שבועית
- מעקב **מלאי** מרובה מרכזי הפצה
- ניהול **מסמכים** (PI / PO) עם תצוגה מקדימה ושיוך לישויות
- **ציות ורגולציה** — מעקב רישיונות ואישורים עם תאריכי תפוגה
- **תקלות** — דיווח ומעקב תקלות מוצרים
- **תהליכי עבודה** — Workflow אוטומטי לרכש
- **תכנון רכש חכם** — חישוב נקודות הזמנה מחדש לפי קצב מכירות ו-Lead Time
- **דוחות** — גרפים ו-KPI על הזמנות, ספקים ומלאי

---

## מודולים

| עמוד | נתיב | תיאור |
|------|-------|--------|
| דשבורד | `/dashboard` | KPIs, הזמנות פתוחות, משימות דחופות, התראות |
| מוצרים | `/products` | רשימת מוצרים עם סינון, מיון, פירוט מורכב |
| תיק מוצר | `/products/:id` | פרטים, רכיבים, הזמנות, תקלות, רישיונות, מסמכים |
| תיק פריט | `/products/:productId/components/:componentId` | פרטי רכיב/פריט בתוך מוצר מורכב, עריכה ומחיקה |
| ספקים | `/suppliers` | רשימת ספקים עם חיפוש וסינון |
| תיק ספק | `/suppliers/:id` | פרטי קשר, מוצרים, הזמנות, מסמכים |
| הזמנות | `/orders` | לוח בקרה, טבלת הזמנות, ארכיון, סדר יום רכש, קבוצות משלוח (5 טאבים) |
| תיק הזמנה | `/orders/:id` | פרטים מלאים, מספר מעקב, ציר זמן Workflow, מסמכים |
| משימות | `/tasks` | לוח קנבן + תצוגה שבועית עם גרירה + גאנט עם תלויות + משימות חוזרות + Workflows |
| המשימות שלי | `/my-tasks` | תצוגת עובד עם טבעת התקדמות, ניהול משימות יומיות |
| פירוט משימה | `/my-tasks/:id` | פרטי משימה, עדכון סטטוס, מידע נוסף |
| מלאי | `/inventory` | זרימת מלאי בין מרכזי הפצה + פירוט עם חיפוש ומיון |
| מסמכים | `/documents` | ניהול PI/PO, תשלומים, תיקיות, ציות ורישיונות, חתימה דיגיטלית |
| תיק מסמך | `/documents/:id` | תצוגה מקדימה, עריכה, הערות PDF, שיוך לישויות |
| תכנון רכש | `/reorder` | ניתוח מלאי + המלצות הזמנה לפי Lead Time |
| תקלות | `/issues` | דיווח ומעקב תקלות מוצרים |
| פרטי תקלה | `/issues/:id` | עמוד תקלה — עריכה inline, עדכונים, גלריית מדיה |
| ניהול פסולת | `/waste-management` | מעקב פסולת ובלאי, חיבור לציוד וסיבות החזרה |
| ציוד ומתקינים | `/equipment` | מעקב ציוד מתקינים: כרטיסי חטיבה, הצטיידויות, מלאי שטח, לוח בקרה |
| פירוט מתקין | `/equipment/installer/:id` | פרטי מתקין, ציוד בשטח, היסטוריית החזרות |
| פרטי חטיבה | `/equipment/division/:divisionName` | טכנאים, הצטיידויות, מלאי, אנשי קשר לפי חטיבה |
| דוחות | `/reports` | גרפי מגמות, ביצועי ספקים, ניתוח הזמנות |
| הגדרות | `/settings` | ניהול צוות, תפקידים, הרשאות גרנולריות, נתונים |
| התראות | `/alerts` | מרכז התראות מערכת ותזכורות |
| מפת מחסן | `/logistics-map` | מפה אינטראקטיבית של המחסן הלוגיסטי עם מלאי בזמן אמת |

---

## תפקידי משתמשים

| תפקיד | כניסה | הרשאות |
|--------|-------|---------|
| `MANAGER` | אימייל + סיסמה | גישה מלאה לכל המודולים + עריכה/מחיקה |
| `WAREHOUSE_MANAGER` | PIN | מלאי, תנועות, עדכון כמויות |
| `LOGISTICS` | PIN | הזמנות, מסמכים, מעקב |
| `DRIVER` | PIN | משימות אישיות בלבד |

**ממשק עובדים** (תפקידי PIN): תצוגה פשוטה עם טבעת התקדמות, ניהול משימות יומיות.

---

## מסד נתונים

מסד הנתונים רץ על **Supabase (PostgreSQL)**. הטבלאות העיקריות:

### מוצרים וספקים
- `products` — מוצרים, מחירים, מלאי, SKU
- `product_components` — רכיבי מוצרים מורכבים
- `product_issues` — תקלות מוצר עם חומרה וסטטוס
- `suppliers` — ספקים
- `supplier_contacts` — אנשי קשר לספקים
- `supplier_price_quotes` — הצעות מחיר מספקים

### הזמנות ומסמכים
- `orders` — הזמנות רכש
- `order_items` — פריטים בהזמנה
- `purchase_documents` — מסמכי PI/PO עם שיוך לספק/מוצר
- `supplier_payments` — תשלומים לספקים

### מלאי
- `distribution_centers` — מרכזי הפצה
- `center_contacts` — אנשי קשר למרכזים
- `center_inventory` — מלאי לפי מרכז
- `inventory_transfers` — היסטוריית העברות מלאי

### משימות
- `tasks` — משימות עם עדיפות, שיוך ותאריך יעד (כולל משימות חוזרות ותלויות)

### פגישות
- `meetings` — פגישות עם כותרת, תאריך ונושאים
- `meeting_action_items` — פריטי פעולה מפגישות

### Workflow
- `workflow_templates` — תבניות תהליך (JSON שלבים)
- `workflow_instances` — הפעלות תהליך על הזמנות
- `workflow_step_logs` — לוג השלמת שלבים

### ציות ורגולציה
- `compliance_items` — רישיונות ואישורים עם תאריכי תפוגה
- `compliance_product_links` — שיוך מסמכי ציות למוצרים

### ציוד ומתקינים
- `installers` — מתקינים (שם, חטיבה, מחסן, טלפון, סטטוס)
- `equipment_pickups` — הצטיידויות (header לפי מתקין ותאריך)
- `equipment_pickup_items` — פריטי הצטיידות (מוצר, כמות, סריאלים)
- `equipment_returns` — החזרות בלאי (header)
- `equipment_return_items` — פריטי החזרה (סיבה, מצב, תוית)
- `division_products` — מוצרי חטיבה (מלאי שטח ידני, דרישה לרבעון, צריכה חודשית מחושבת)

### ניהול פסולת
- `waste_items` — פריטי פסולת/בלאי (מוצר, כמות, מקור, המלצות)

### מפת מחסן
- `warehouse_zone_products` — שיוך מוצרים לאזורים במחסן (zone_id, product_id)

### ניהול משתמשים
- `profiles` — פרופילי משתמשים (שם, תפקיד, חטיבה — לניהול גישה מנהל חטיבה)
- `user_roles` — תפקידים
- `role_definitions` — הגדרות תפקידים ורשאות
- `role_permissions` — הרשאות גרנולריות לפי תפקיד ומודול
- `user_preferences` — העדפות משתמש (מיון, תצוגה)
- `login_attempts` — לוג ניסיונות כניסה
- `sap_sync_log` — לוג סנכרון SAP
- `learning_journal` — יומן למידה
- `audit_log` — לוג פעילות מלא (פעולה, ישות, משתמש, IP)

---

## טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| State / Data | TanStack React Query + Supabase Realtime |
| Backend / DB | Supabase (PostgreSQL + Edge Functions + Storage) |
| ניתוב | React Router v6 |
| גרפים | Recharts |
| תאריכים | date-fns (עם locale עברית) |
| אייקונים | Lucide React |
| Toasts | Sonner |
| טפסים | React Hook Form + Zod |
| PDF | PDF.js + pdf-lib + mammoth |
| אוטומציה | MCP Server — 245 כלים ב-32 מודולים לאינטגרציה עם Claude Code |
| בדיקות E2E | Playwright |

---

## התקנה והרצה

### דרישות מוקדמות
- Node.js ≥ 18
- npm ≥ 9
- חשבון Supabase עם פרויקט מוגדר

### הרצה מקומית

```bash
# שכפל את הריפו
git clone <YOUR_GIT_URL>
cd cobra-command-center

# התקן תלויות
npm install

# הגדר משתני סביבה
cp .env.example .env.local
# ערוך את .env.local עם ה-URL וה-ANON KEY של Supabase

# הפעל שרת פיתוח
npm run dev
```

האפליקציה תרוץ על `http://localhost:8080`

### בניה לייצור

```bash
npm run build
npm run preview
```

---

## מבנה תיקיות

```
src/
├── components/          # קומפוננטים משותפים
│   ├── ui/              # shadcn/ui primitives
│   ├── tasks/           # קומפוננטי משימות (Board, WeeklyView, RecurringPanel...)
│   ├── orders/          # דיאלוג יצירת הזמנה
│   ├── products/        # טפסי עריכת מוצר
│   ├── documents/       # עורך PDF, תצוגה מקדימה, תיקיות
│   ├── equipment/       # קומפוננטי ציוד ומתקינים
│   ├── settings/        # ניהול עובדים, הרשאות
│   ├── DocumentsSection.tsx   # סקשן מסמכים משותף לישויות
│   ├── InlineEditField.tsx    # עריכה inline
│   ├── PriorityBadge.tsx      # תג עדיפות
│   └── StatusBadge.tsx        # תג סטטוס הזמנה
├── contexts/
│   └── AppContext.tsx    # Context מרכזי — Auth + barrel ל-domain contexts
├── hooks/               # Custom React hooks (useColumnVisibility, usePermissions, useSortState...)
├── layouts/             # עטיפות layout לדפים
├── integrations/
│   └── supabase/        # Client + Types אוטומטיים
├── pages/               # דפי האפליקציה (ראה טבלה למעלה)
├── lib/
│   ├── utils.ts         # cn() + עזרים
│   ├── errorHandler.ts  # טיפול שגיאות + toast
│   ├── logger.ts        # לוגר מובנה עם רמות
│   ├── activityLogger.ts # לוג פעילות ל-audit_log
│   └── schemas/         # Zod validation schemas לטפסים
└── App.tsx              # Router + Layout + ErrorBoundary
mcp-server/              # MCP Server לאינטגרציה עם Claude Code (30+ כלים)
```

---

## הגדרת Supabase Storage

שתי buckets נדרשות:
- **`documents`** — מסמכי PI/PO, קבצי ציות
- **`issue-images`** — תמונות תקלות מוצרים

הגדר Row Level Security (RLS) בהתאם לתפקידי המשתמשים.

---

## Edge Functions

| Function | תפקיד |
|----------|--------|
| `create-employee` | יצירת עובד חדש עם PIN |
| `manage-employee` | עדכון פרטי עובד ותפקיד |
| `generate-recurring-tasks` | יצירה אוטומטית של משימות חוזרות |
| `advance-overdue-tasks` | הזזת משימות שעבר מועדן ליום הבא |
| `seed-data` | הזנת נתוני דוגמה לסביבת פיתוח |
| `migrate-external` | העברת נתונים ממסד נתונים חיצוני |
| `setup-external` | הגדרת חיבור למסד נתונים חיצוני |
| `check-compliance` | בדיקת תוקף רישיונות ואישורי ציות |
| `fix-setup` | תיקון הגדרות מסד נתונים |
| `fix-trigger` | תיקון Triggers ו-Policies ב-Supabase |
| `debug-external` | כלי דיבאג לחיבורים חיצוניים |
| `health` | בדיקת בריאות שרת + זמן תגובה DB (ללא אימות) |

---

## MCP Tools

שרת MCP מאפשר ל-Claude Code גישה ישירה לכל מסד הנתונים ללא ממשק גרפי — **245 כלים** ב-**32 מודולים**.

| מודול | Domain | כלים |
|-------|--------|-----:|
| `analytics` | Analytics & KPIs | 6 |
| `audit-logs` | Audit trail | 2 |
| `bulk-ops` | Bulk operations | 5 |
| `compliance` | Compliance & licensing | 7 |
| `daily-reports` | Daily reports | 5 |
| `divisions` | Division management | 4 |
| `documents` | Documents (PI/PO) | 10 |
| `equipment` | Equipment & installers | 36 |
| `finance` | Finance summary | 4 |
| `goals` | Goals tracking | 4 |
| `inventory` | Inventory & warehouses | 11 |
| `issues` | Product issues | 16 |
| `learning-journal` | Learning journal | 5 |
| `meetings` | Meetings & decisions | 14 |
| `notifications` | Notifications | 3 |
| `order-payments` | Order payments | 5 |
| `orders` | Orders lifecycle | 13 |
| `payments` | Supplier payments | 4 |
| `procurement-agenda` | Procurement agenda | 2 |
| `procurement-inventory` | Procurement inventory | 6 |
| `procurement-meeting` | Procurement meetings | 7 |
| `products` | Products & components | 13 |
| `reminders` | Reminders | 3 |
| `search` | Global search | 4 |
| `shipping` | Shipping & logistics | 9 |
| `suppliers` | Suppliers | 13 |
| `tasks` | Tasks | 7 |
| `team` | Team & permissions | 9 |
| `user-preferences` | User preferences | 3 |
| `warehouse` | Warehouse zones | 6 |
| `waste` | Waste tracking | 5 |
| `workflows` | Workflows | 4 |

ראה [docs/MCP_TOOLS.md](docs/MCP_TOOLS.md) לתיעוד מלא: מיפוי טבלה→מודול, תהליך עדכון, ו-pattern להוספת מודול חדש.

---

## תיעוד נוסף

- [Infrastructure & DevOps](docs/INFRASTRUCTURE.md) — ארכיטקטורה, גיבויים, CI/CD, נהלי תקלות
- [Database Migrations](docs/MIGRATIONS.md) — כיצד להריץ ולהוסיף migrations
- [Backlog](docs/BACKLOG.md) — תכונות פתוחות לפיתוח עתידי
- [Scheduled Task Prompt](docs/SCHEDULED_TASK_PROMPT.md) — תהליך דוח בוקר יומי (Noam)
- [MCP Tools Reference](docs/MCP_TOOLS.md) — inventory מלא, table→module mapping, update process

---

*COBRA Command Center — בנוי עם ❤️ ו-Supabase*
