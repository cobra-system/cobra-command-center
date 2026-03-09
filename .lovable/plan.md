

## תוכנית: מערכת משימות חוזרות (Recurring Tasks)

### סקירה
נבנה מערכת שמאפשרת להגדיר משימות חוזרות שנוצרות אוטומטית לפי לוח זמנים - יומי, שבועי, חודשי, רבעוני או שנתי. המערכת תתמוך ביצירה מראש (למשל 14 יום לפני) ותסנכרן עם מערכת המשימות הקיימת.

---

### מה נבנה

#### 1. טבלה חדשה: `recurring_tasks`

| שדה | תיאור |
|-----|-------|
| `title` | שם המשימה |
| `description` | תיאור |
| `frequency` | יומי / שבועי / חודשי / רבעוני / שנתי |
| `day_of_week` | לשבועי - 0-6 (ראשון-שבת) |
| `day_of_month` | לחודשי - 1-31 |
| `time_of_day` | שעת היצירה (16:00 ללוז מחסן) |
| `days_before` | כמה ימים מראש ליצור (0 = באותו יום) |
| `assignee_id` | למי לשייך |
| `priority` | עדיפות |
| `is_active` | פעיל/מושבת |
| `last_generated` | מתי נוצרה משימה אחרונה |
| `next_due` | תאריך היעד הבא |

#### 2. דף ניהול משימות חוזרות

- לשונית חדשה בעמוד המשימות או דף נפרד
- רשימת כל המשימות החוזרות המוגדרות
- יצירה/עריכה/מחיקה/השבתה
- תצוגת "מתי התרחשות הבאה"

#### 3. Edge Function ליצירת משימות

- פונקציה שרצה ב-CRON יומי (06:00)
- בודקת אילו משימות צריכות להיווצר היום
- יוצרת משימות חדשות בטבלת `tasks`
- מעדכנת `last_generated` ו-`next_due`

#### 4. שילוב עם המשימות הרגילות

- בכרטיס משימה - תווית "חוזרת" + קישור להגדרה
- במסנן - אפשרות לסנן "חוזרות בלבד"

---

### המשימות שנגדיר מראש

| משימה | תדירות | יום | שעה | מראש |
|--------|---------|-----|-----|------|
| העברת חשבוניות ממחסן | שבועי | ראשון | 09:00 | 0 |
| ישיבת רכש עם ארנון | שבועי | שני | 09:00 | 1 |
| ישיבת רכש PI | שבועי | שני + חמישי | 09:00 | 1 |
| יישור קו תשלומים עם קרן | חודשי | 1 | 09:00 | 3 |
| לוז נסיעות מחסן | יומי | - | 16:00 | 0 |
| הזמנה מ-ERM | רבעוני | - | 09:00 | 14 |
| הזמנה מ-VODAFONE | חצי-שנתי | - | 09:00 | 30 |
| חידוש רישיונות יבוא | שנתי | - | 09:00 | 60 |

---

### פרטים טכניים

**DB Migration:**
```sql
CREATE TABLE recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL, -- daily/weekly/monthly/quarterly/yearly
  day_of_week INTEGER, -- 0-6
  day_of_month INTEGER, -- 1-31
  time_of_day TIME DEFAULT '09:00',
  days_before INTEGER DEFAULT 0,
  assignee_id UUID,
  assignee_name TEXT,
  priority TEXT DEFAULT 'בינוני',
  is_active BOOLEAN DEFAULT true,
  last_generated TIMESTAMPTZ,
  next_due DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Edge Function:** `generate-recurring-tasks`
- CRON יומי ב-06:00
- לוגיקה: `next_due - days_before <= today`
- יוצר משימה ב-tasks עם `due_date = next_due`
- מחשב `next_due` הבא

**קבצים חדשים:**
- `src/pages/RecurringTasksPage.tsx` - דף ניהול
- `supabase/functions/generate-recurring-tasks/index.ts`

**קבצים לעדכון:**
- `src/App.tsx` - Route חדש
- `src/layouts/ManagerLayout.tsx` - קישור בתפריט
- `src/contexts/AppContext.tsx` - פונקציות CRUD

---

### סדר ביצוע

1. יצירת טבלה + RLS
2. הוספה ל-AppContext (fetch, add, update, delete)
3. בניית דף ניהול RecurringTasksPage
4. יצירת Edge Function + CRON
5. Seeding נתונים ראשוניים (8 המשימות)
6. בדיקה

