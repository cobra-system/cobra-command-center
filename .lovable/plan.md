

# תכנון מחדש של מערכת המסמכים

## מה המשתמש רוצה
1. **ביטול סיווג אוטומטי (AI)** - להסיר את FileUploadDialog עם ה-AI classification
2. **העלאה פשוטה** - drag & drop / בחירת קובץ, עם שם שהמשתמש נותן
3. **שיוך ידני** - המשתמש בוחר לאיזו ישות לשייך (מוצר / הזמנה / ספק)
4. **ממש פשוט** - לא טופס מסובך, פשוט מקום "לזרוק אליו קובץ"
5. **גם מתוך דפי ישויות** (הזמנה, מוצר, ספק) - אותו חוויה פשוטה

## מה משתנה ב-DB

הטבלה `purchase_documents` הקיימת כבר מכילה `file_url`, `supplier_id`, `product_id`, `order_id`, `notes`, `type`. נוסיף עמודה `document_name` (שם שהמשתמש נותן) ונשנה את ה-CHECK constraint על `type` כדי לתמוך ביותר סוגים. נסיר את החובה של `type` IN ('PI','PO') ונאפשר גם ערכים כלליים.

### Migration:
```sql
ALTER TABLE purchase_documents DROP CONSTRAINT IF EXISTS purchase_documents_type_check;
ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE purchase_documents ALTER COLUMN quantity SET DEFAULT 0;
```

## שינויי קוד

### 1. רכיב העלאה חדש: `SimpleFileUploadDialog`
- Dialog פשוט עם:
  - אזור drag & drop להעלאת קובץ
  - שדה "שם מסמך" (חובה)
  - בחירת סוג (PI / PO / כללי)
  - שיוך אופציונלי: ספק, מוצר, הזמנה (מוצג לפי הקונטקסט)
  - כפתור "שמור"
- כשנקרא מתוך דף ישות - השיוך ממולא אוטומטית ומוסתר
- מחליף גם את `DocumentFormDialog` וגם את `FileUploadDialog`

### 2. עדכון `DocumentsPage.tsx`
- כפתור אחד "העלה מסמך" במקום שני כפתורים (מסמך חדש + העלה קובץ)
- שימוש ב-`SimpleFileUploadDialog` החדש

### 3. עדכון `DocumentsSection.tsx` (בדפי ישויות)
- החלפת `DocumentFormDialog` ב-`SimpleFileUploadDialog` עם pre-fill של ה-entity

### 4. עדכון `DocumentsTable.tsx`
- הוספת עמודת "שם" (document_name)
- אייקון קובץ מצורף כשיש file_url

### 5. עדכון `DocumentDetailPage.tsx`
- הוספת שדה inline edit לשם המסמך

### 6. מחיקות
- הסרת `FileUploadDialog.tsx` (AI classification)
- הסרת `classify-document` edge function
- הסרת `DocumentFormDialog.tsx` (הטופס המורכב)

## סדר ביצוע
1. Migration (הוספת document_name, הסרת constraint)
2. יצירת `SimpleFileUploadDialog`
3. עדכון `DocumentsPage`, `DocumentsSection`, `DocumentDetailPage`, `DocumentsTable`
4. מחיקת קבצים ישנים

