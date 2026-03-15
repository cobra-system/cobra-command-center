

# סטטוס מערכת — מה הושלם, מה חסר, מה לא נבדק

## מה הושלם (מהבקשות האחרונות)

| פיצ'ר | סטטוס |
|-------|-------|
| דשבורד — עיצוב מחדש (KPI + רשימות) | ✅ מיושם |
| תיק הזמנה — עריכה inline | ✅ מיושם |
| יצירת הזמנה מתיק מוצר/ספק | ✅ מיושם |
| יצירת מסמך מתיק מוצר/ספק | ✅ מיושם |
| דוחות — טאבים + גרפים | ✅ מיושם |
| Error handling + rollback ב-AppContext | ✅ מיושם (כל ה-CRUD) |
| OrdersPage — תמיכה בפרמטרי newOrder | ✅ תוקן |

---

## מה עדיין חסר / לא טופל

### 1. כפילויות מלאי — לא טופל
`center_inventory` חסר UNIQUE constraint על `(center_id, product_id)`. ב-`InventoryPage.tsx` שורה 131-138, הקוד בודק קיום ידנית אבל אין הגנה ברמת DB. כפילויות קיימות לא נוקו.

**נדרש:** migration להוספת UNIQUE constraint + סקריפט ניקוי כפילויות קיימות.

### 2. `addProfile` — עדיין stub ריק (שורה 613-615)
```ts
const addProfile = useCallback(async (profile) => {
  await refreshProfiles(); // לא שומר כלום!
}, [refreshProfiles]);
```

### 3. Real-time חסר לרוב הישויות
רק `tasks` יש להם realtime subscription. הזמנות, מוצרים, ספקים — אין.

### 4. N+1 ב-WorkflowsPage
לא טופל — עדיין שולח קריאות DB נפרדות לכל workflow instance.

### 5. דוח משימות — סינון חודשי
ב-ReportsPage החדש צריך לוודא שחישוב משימות מסנן לפי `created_at` של החודש הנבחר ולא כל הזמנים.

### 6. `as any` נרחב
עדיין קיים ב-AppContext (שורות 541, 553, 592) וב-InventoryPage (שורות 114, 126, 134, 136).

### 7. אין בדיקות (tests)
הבדיקה היחידה עדיין `expect(true).toBe(true)`.

### 8. אזהרת React Console
`Function components cannot be given refs` ב-`ProductIssuesTab.tsx` (שורה 1420) — `ResolutionInput` חסר `forwardRef`.

---

## מה לא נבדק (לא אומת מול ממשק חי)

- הדשבורד החדש — האם הגרפים מוצגים נכון, האם הנתונים נטענים
- יצירת הזמנה מתיק מוצר — האם השדות באמת מתמלאים אוטומטית
- יצירת מסמך מתיק ספק — אותו הדבר
- דוחות — האם כל הטאבים מציגים גרפים עם נתונים אמיתיים
- Inline editing בהזמנה — האם שמירה באמת עובדת

---

## המלצה לסדר עדיפויות

1. **כפילויות מלאי** — migration + ניקוי (קריטי, נתונים שגויים)
2. **בדיקה ויזואלית** של כל הפיצ'רים החדשים בממשק
3. **forwardRef fix** ב-ProductIssuesTab (אזהרת console)
4. **addProfile stub** — להשלים או לתעד כ-deprecated
5. **N+1 WorkflowsPage** — לשכתב עם joins

