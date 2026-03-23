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
| משימות | `/tasks` | לוח קנבן (לביצוע / הושלם) + תצוגה שבועית עם גרירה + תצוגת גאנט עם תלויות |
| מלאי | `/inventory` | זרימת מלאי בין מרכזי הפצה + פירוט עם חיפוש ומיון |
| מסמכים | `/documents` | רשימת PI/PO + תשלומים |
| תיק מסמך | `/documents/:id` | תצוגה מקדימה, עריכה, שיוך לספק/מוצר/הזמנה/משימה |
| ציות | `/compliance` | מעקב רישיונות ואישורים לפי קטגוריה ותאריך תפוגה |
| תכנון רכש | `/reorder` | ניתוח מלאי + המלצות הזמנה לפי Lead Time |
| תקלות | `/issues` | דיווח ומעקב תקלות מוצרים |
| תהליכים | `/workflows` | ניהול Workflow instances ותבניות |
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

### ניהול משתמשים
- `profiles` — פרופילי משתמשים (שם, תפקיד, PIN)
- `user_roles` — תפקידים
- `role_definitions` — הגדרות תפקידים ורשאות
- `role_permissions` — הרשאות גרנולריות לפי תפקיד ומודול
- `user_preferences` — העדפות משתמש (מיון, תצוגה)
- `login_attempts` — לוג ניסיונות כניסה
- `sap_sync_log` — לוג סנכרון SAP
- `learning_journal` — יומן למידה

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
│   ├── DocumentsSection.tsx   # סקשן מסמכים משותף לישויות
│   ├── InlineEditField.tsx    # עריכה inline
│   ├── PriorityBadge.tsx      # תג עדיפות
│   ├── StatusBadge.tsx        # תג סטטוס הזמנה
│   └── SapSyncBadge.tsx       # תג סנכרון SAP
├── contexts/
│   └── AppContext.tsx    # Context מרכזי — נתונים, Auth, CRUD
├── integrations/
│   └── supabase/        # Client + Types אוטומטיים
├── pages/               # דפי האפליקציה (ראה טבלה למעלה)
├── lib/
│   └── utils.ts         # cn() + עזרים
└── App.tsx              # Router + Layout
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

---

*COBRA Command Center — בנוי עם ❤️ ו-Supabase*
