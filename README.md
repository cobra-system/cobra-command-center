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
| דשבורד | `/` | KPIs, הזמנות פתוחות, משימות דחופות, התראות |
| מוצרים | `/products` | רשימת מוצרים עם סינון, מיון, פירוט מורכב |
| תיק מוצר | `/products/:id` | פרטים, רכיבים, הזמנות, תקלות, רישיונות, מסמכים |
| ספקים | `/suppliers` | רשימת ספקים עם חיפוש וסינון |
| תיק ספק | `/suppliers/:id` | פרטי קשר, מוצרים, הזמנות, מסמכים |
| הזמנות | `/orders` | לוח הזמנות עם סינון מתקדם ומיון |
| תיק הזמנה | `/orders/:id` | פרטים מלאים, מספר מעקב, ציר זמן Workflow, מסמכים |
| משימות | `/tasks` | לוח קנבן + תצוגה שבועית עם גרירה + גאנט עם תלויות + משימות חוזרות + Workflows |
| המשימות שלי | `/my-tasks` | תצוגת עובד עם טבעת התקדמות, ניהול משימות יומיות |
| מלאי | `/inventory` | זרימת מלאי בין מרכזי הפצה + פירוט עם חיפוש ומיון |
| מסמכים | `/documents` | ניהול PI/PO, תשלומים, תיקיות, ציות ורישיונות, חתימה דיגיטלית |
| תיק מסמך | `/documents/:id` | תצוגה מקדימה, עריכה, הערות PDF, שיוך לישויות |
| תכנון רכש | `/reorder` | ניתוח מלאי + המלצות הזמנה לפי Lead Time |
| תקלות | `/issues` | דיווח ומעקב תקלות מוצרים |
| ניהול פסולת | `/waste-management` | מעקב פסולת ובלאי, חיבור לציוד וסיבות החזרה |
| ציוד ומתקינים | `/equipment` | מעקב ציוד מתקינים: הצטיידויות, החזרות, QC |
| פירוט מתקין | `/equipment/installer/:id` | פרטי מתקין, ציוד בשטח, היסטוריית החזרות |
| דוחות | `/reports` | גרפי מגמות, ביצועי ספקים, ניתוח הזמנות |
| הגדרות | `/settings` | ניהול צוות, תפקידים, הרשאות גרנולריות, נתונים |
| פגישות | `/meetings` | ניהול פגישות, פרוטוקולים ופריטי פעולה |

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
- `tasks` — משימות עם עדיפות, שיוך ותאריך יעד
- `recurring_tasks` — תבניות משימות חוזרות
- `task_dependencies` — תלויות בין משימות (תצוגת גאנט)

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

### ניהול פסולת
- `waste_items` — פריטי פסולת/בלאי (מוצר, כמות, מקור, המלצות)

### ניהול משתמשים
- `profiles` — פרופילי משתמשים (שם, תפקיד, PIN)
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
| אוטומציה | MCP Server — 30+ כלים לאינטגרציה עם Claude Code |
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
| `classify-document` | סיווג מסמך אוטומטי ע"י AI (זיהוי ספק, סוג, מחיר) |
| `login-with-pin` | אימות כניסה ע"י PIN לתפקידי עובדים |
| `create-employee` | יצירת עובד חדש עם PIN |
| `manage-employee` | עדכון פרטי עובד ותפקיד |
| `sap-proxy` | פרוקסי לסנכרון עם מערכת SAP |
| `generate-recurring-tasks` | יצירה אוטומטית של משימות חוזרות |
| `seed-data` | הזנת נתוני דוגמה לסביבת פיתוח |
| `migrate-external` | העברת נתונים ממסד נתונים חיצוני |
| `setup-external` | הגדרת חיבור למסד נתונים חיצוני |
| `check-compliance` | בדיקת תוקף רישיונות ואישורי ציות |
| `fix-setup` | תיקון הגדרות מסד נתונים |
| `fix-trigger` | תיקון Triggers ו-Policies ב-Supabase |
| `debug-external` | כלי דיבאג לחיבורים חיצוניים |
| `health` | בדיקת בריאות שרת + זמן תגובה DB (ללא אימות) |

---

## תיעוד נוסף

- [Infrastructure & DevOps](docs/INFRASTRUCTURE.md) — ארכיטקטורה, גיבויים, CI/CD, נהלי תקלות
- [Database Migrations](docs/MIGRATIONS.md) — כיצד להריץ ולהוסיף migrations
- [Backlog](docs/BACKLOG.md) — תכונות פתוחות לפיתוח עתידי
- [Scheduled Task Prompt](docs/SCHEDULED_TASK_PROMPT.md) — תהליך דוח בוקר יומי (Noam)

---

*COBRA Command Center — בנוי עם ❤️ ו-Supabase*
