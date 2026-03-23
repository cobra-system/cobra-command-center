# CHANGELOG

כל השינויים המשמעותיים במערכת COBRA Command Center מתועדים כאן.
פורמט מבוסס על [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [2026-03-23]

- Merge pull request #46 from cobra-system/claude/fix-goal-creation-gkDNg (f3a582a)
- fix: apply goals table migration at runtime to resolve schema cache error (80c0ef6)

<!-- last-commit: f3a582a8abf1d19094170f797f06c97b6af1037c -->

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

