# תוכנית עבודה — חיזוק COBRA Command Center

**תאריך הכנה:** 11/03/2026
**ענף:** `claude/system-assessment-plan-6tvJf`

---

## סיכום ממצאים

לאחר סריקה מלאה של הקוד זוהו 6 אזורי חולשה עיקריים, ממוינים לפי חומרה:

---

## 🔴 קריטי — חיוני לתפקוד תקין

### 1. מוטציות ב-AppContext ללא טיפול בשגיאות
**קבצים:** `src/contexts/AppContext.tsx`

כמעט כל פעולות ה-CRUD שולחות פקודה ל-Supabase ומתעלמות לחלוטין מהתוצאה:
```ts
// כך זה עכשיו — שגיאה "נעלמת" בשקט
await supabase.from("tasks").insert(task);
await refreshTasks();

// פונקציות ספציפיות שחסר בהן error handling:
// addTask, updateTask, deleteTask
// addOrder, updateOrder, deleteOrder
// addProduct, updateProduct, deleteProduct
// addComponent, updateComponent, deleteComponent
// addSupplier, updateSupplier, deleteSupplier
// updateProfile
// addRoleDefinition, updateRoleDefinition, deleteRoleDefinition
```
**תוצאה:** משתמש לוחץ "שמור" — לא קורה כלום, ולא מקבל שום הסבר.

**תיקון נדרש:** לכל פעולת CRUD — לבדוק `error`, לזרוק `toast.error`, ולא לעדכן state אם הפעולה נכשלה.

---

### 2. `addProfile` — פונקציה ריקה לגמרי
**קבצים:** `src/contexts/AppContext.tsx:516-518`

```ts
const addProfile = useCallback(async (profile: { email: string; name: string; role: Role; pin?: string }) => {
  await refreshProfiles(); // זה הכל — שום דבר לא נשמר!
}, [refreshProfiles]);
```
**תוצאה:** כל מי שקורא ל-`addProfile` חושב שהוסיף משתמש, אבל לא קרה כלום.

**תיקון נדרש:** להסיר או להשלים את הפונקציה (ניתן לראות שניהול עובדים עובר דרך `createEmployee` — צריך לתעד את ההחלטה).

---

### 3. Optimistic Updates ללא Rollback
**קבצים:** `src/contexts/AppContext.tsx:424-428, 436-438`

```ts
const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
  ownMutationIds.current.add(taskId);
  setTasks(prev => prev.map(...)); // ← עדכון מיידי של state
  await supabase.from("tasks").update({ status }).eq("id", taskId); // ← אם זה נכשל — state נשאר "מזויף"
}, []);
```
**תוצאה:** UI מראה מצב שגוי אם DB נכשל.

**תיקון נדרש:** להוסיף `try/catch` עם rollback על state במקרה של כישלון.

---

## 🟠 גבוה — פוגע בחוויה / אמינות נתונים

### 4. Real-Time חסר לרוב הישויות
**קבצים:** `src/contexts/AppContext.tsx:376-421`

יש Realtime subscription **רק למשימות**. שינויים של משתמשים אחרים ב:
- מוצרים, הזמנות, ספקים, מלאי

... לא מתעדכנים בזמן אמת — דורשים רענון ידני.

**תיקון נדרש:** להוסיף subscriptions גם ל-`orders` ו-`products` לפחות (עדיפות גבוהה למשתמשים מרובים).

---

### 5. N+1 Query Problem ב-WorkflowsPage
**קבצים:** `src/pages/WorkflowsPage.tsx:104-133`

```ts
const enriched = await Promise.all(iData.map(async (inst) => {
  // קריאה נפרדת ל-DB לכל instance!
  const { data: oData } = await supabase.from("orders").select(...).eq("id", inst.order_id).single();
  const { data: items } = await supabase.from("order_items").select(...).eq("order_id", inst.order_id);
  const { data: logs } = await supabase.from("workflow_step_logs").select(...).eq("instance_id", inst.id);
}));
```
עם 20 instances = **60+ קריאות מקבילות לDB**.

**תיקון נדרש:** להשתמש ב-Supabase joins (`.select("*, orders(*), workflow_step_logs(*)")`) כדי להביא הכל בקריאה אחת.

---

### 6. דוח משימות לא מדויק
**קבצים:** `src/pages/ReportsPage.tsx:68-70`

```ts
const tasksClosed = tasks.filter(t => t.status === "DONE").length; // כל הזמנים, לא רק החודש
const tasksOpened = tasks.length;                                    // כל הזמנים
```
**תוצאה:** דוח חודשי מציג נתוני משימות ממוצע כולל, לא רק של החודש הנבחר.

**תיקון נדרש:** להוסיף `created_at`/`completed_at` לטבלת `tasks` ולסנן לפי טווח תאריכים.

---

## 🟡 בינוני — איכות קוד ותחזוקה

### 7. אין כיסוי בדיקות
**קבצים:** `src/test/example.test.ts`

```ts
// הבדיקה היחידה במערכת:
it("should pass", () => {
  expect(true).toBe(true);
});
```
אין אף בדיקה אמיתית לאף לוגיקה עסקית.

**תיקון נדרש:** להוסיף בדיקות ל:
1. לוגיקת חישוב ReorderPage (נקודות הזמנה מחדש)
2. פעולות CRUD ב-AppContext (mock Supabase)
3. חישובי דוחות ב-ReportsPage

---

### 8. שימוש נרחב ב-`as any`
**קבצים:** AppContext.tsx, SapSettingsPage.tsx ועוד

```ts
await supabase.from("suppliers").insert(supplier as any);
await supabase.from("products").update(dbUpdates).eq("id", id); // dbUpdates = any
```
מסתיר שגיאות TypeScript שיכולות להצביע על bugs אמיתיים.

**תיקון נדרש:** להחליף ב-typed interfaces מה-`src/integrations/supabase/types.ts`.

---

### 9. כפילות לוגיקת fetch ב-Dashboard
**קבצים:** `src/pages/DashboardPage.tsx:32-124`

הדשבורד מבצע fetch ישיר ל-Supabase במקום לצרוך נתונים מ-AppContext. יוצר fetch כפול + לא מנצל caching.

**תיקון נדרש:** לשקול העברת הנתונים הנדרשים לקונטקסט, או שימוש ב-React Query.

---

## סדר עדיפויות לביצוע

| # | משימה | עדיפות | מורכבות | השפעה |
|---|-------|---------|---------|-------|
| 1 | Error handling ל-CRUD ב-AppContext | קריטי | בינוני | גבוהה מאוד |
| 2 | תיקון / הסרת `addProfile` | קריטי | נמוך | גבוהה |
| 3 | Rollback על optimistic updates | קריטי | בינוני | גבוהה |
| 4 | Real-time ל-orders ו-products | גבוה | בינוני | גבוהה |
| 5 | N+1 Fix ב-WorkflowsPage | גבוה | נמוך | בינוני |
| 6 | תיקון דוח משימות | גבוה | בינוני | בינוני |
| 7 | הוספת בדיקות | בינוני | גבוה | ארוך טווח |
| 8 | טיפול ב-`as any` | בינוני | גבוה | ארוך טווח |

---

## הצעת Sprint ראשון (ביצוע מיידי)

**יעד:** לטפל בכל הבעיות הקריטיות + N+1

1. **AppContext — Error Handling** — להוסיף `try/catch` + `toast.error` לכל מוטציה
2. **AppContext — Rollback** — להחזיר state קודם אם DB נכשל
3. **AppContext — `addProfile` stub** — להוסיף הערת deprecation + לתעד
4. **WorkflowsPage — N+1** — לשכתב עם joins
5. **ReportsPage — tasks filter** — לתקן את חישוב הדוח

**Sprint שני:**
6. Realtime ל-orders
7. בדיקות יחידה ראשוניות
