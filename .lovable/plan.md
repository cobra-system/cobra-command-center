

# תיאור מפורט של המערכת הנוכחית — COBRA Operations

## סקירה כללית

COBRA Operations היא מערכת ניהול רכש ולוגיסטיקה מלאה, בנויה ב-React + TypeScript עם backend על Lovable Cloud. המערכת מיועדת לניהול שרשרת האספקה של חברת Cobra — מניהול מוצרים וספקים, דרך הזמנות ומלאי, ועד משימות צוות ודוחות.

## מודולים קיימים

### 1. אימות והרשאות
- כניסה באימייל/סיסמא, קוד PIN, או Google OAuth
- שני סוגי משתמשים: **מנהל** (MANAGER) ו**עובד** (DRIVER/WAREHOUSE_MANAGER/LOGISTICS)
- מנהלים רואים את כל המערכת; עובדים רואים רק את המשימות שלהם
- RLS policies על כל הטבלאות — מנהלים יכולים לכתוב, כולם יכולים לקרוא

### 2. דשבורד (`/dashboard`)
- KPIs: מוצרים פעילים, הזמנות בדרך, משימות פתוחות, ספקים פעילים
- טופ 3 משימות פתוחות (ממוינות לפי עדיפות)
- הזמנות פתוחות ממוינות לפי עדיפות
- גרף מלאי קיים מול הזמנה חודשית
- אימיילים אחרונים מספקים (Outlook integration)

### 3. מוצרים (`/products`, `/products/:id`)
- קטלוג מוצרים עם קטגוריות, מק"ט, סוג (מוגמר/מורכב), ספק, מחירים, מלאי
- **חטיבות** (divisions) — רב-בחירה מרשימה קבועה: AWCAS, דלק מוטורס, פריזבי, לובינסקי, סלקום, פלאפון, גולן טלקום
- **רכיבים** (components) למוצרים מורכבים
- **תקלות** (product issues) — דיווח ומעקב
- עריכה inline בדאבל-קליק עם dropdown לשדות מוגדרים

### 4. הזמנות (`/orders`, `/orders/:id`)
- עדיפות: דחוף / גבוה / בינוני / נמוך
- סטטוסים: ממתין → הוזמן → נשלח → הגיע / בוטל
- שדות: ספק, משלוח, תאריך הזמנה, ETD, ETA, סה"כ מחיר, תשלום
- פריטי הזמנה (order_items) עם כמות ומחיר
- סינון ומיון מתקדם, שינוי סטטוס מהיר

### 5. ספקים (`/suppliers`, `/suppliers/:id`)
- פרטי ספק: שם חברה, איש קשר, אימייל, טלפון, מדינה, תנאי תשלום
- ספק גיבוי
- הצעות מחיר מספקים (supplier_price_quotes)
- תשלומים לספקים (supplier_payments)
- השוואת ספקים ושליחת אימיילים

### 6. מלאי (`/inventory`)
- **מרכזי הפצה**: מרכז ראשי בת"א + בונדדים (דלק מוטורס, פריזבי, לובינסקי)
- אנשי קשר לכל מרכז
- כמויות מלאי לכל מוצר בכל מרכז + סף מינימום
- **העברות מלאי** בין מרכזים עם היסטוריה
- **התראות מלאי נמוך** — חיווי ויזואלי כשכמות יורדת מתחת לסף
- המחשה גרפית של זרימה: יבוא → מרכז ת"א → בונדדים

### 7. מסמכים (`/documents`)
- סוגי מסמכים: PI (הצעת מחיר), PO (הזמנת רכש), תשלום, אחר
- העלאת קבצים ל-Storage
- **סיווג אוטומטי** באמצעות AI (edge function + Gemini)
- אישור מסמכים, סטטוסים

### 8. משימות (`/tasks`, `/my-tasks`)
- משימות עם עדיפות, סטטוס (לביצוע/בביצוע/הושלם/חסום), שיוך לעובד
- משימות יומיות (is_daily)
- **Realtime** — עדכונים חיים בין משתמשים
- עובדים רואים רק את המשימות שלהם ב-`/my-tasks`

### 9. תכנון רכש (`/reorder`)
- חישוב אוטומטי של ימים עד אזילת מלאי
- נקודת הזמנה מחדש, lead time
- חיווי סכנה/אזהרה/תקין

### 10. דוחות (`/reports`)
- דוח חודשי: הזמנות שנפתחו/הושלמו/עוכבו, משלוחים, משימות, תקלות, תשלומים

### 11. הגדרות (`/settings`)
- ניהול צוות: יצירת עובדים, PIN, תפקידים
- **ניהול תפקידים** (role_definitions) — הוספה, עריכה, מחיקה של שמות תפקידים

### 12. UI/UX
- RTL מלא (עברית)
- Sidebar עם סדר גרירה (drag & drop), נשמר ב-localStorage
- Splash screen
- עיצוב כהה מודרני
- InlineEditField — עריכה ישירה בדאבל-קליק עם תמיכה ב-multi-select ו-dropdowns

## מבנה הנתונים (טבלאות)
```text
products ─── product_components
         ─── product_issues
         ─── center_inventory ─── distribution_centers ─── center_contacts
         ─── supplier_price_quotes ─── suppliers ─── supplier_payments
orders ──── order_items
tasks
profiles ─── user_roles
role_definitions
purchase_documents
inventory_transfers
learning_journal
```

## אינטגרציות קיימות
- **Outlook** (OutlookContext + MSAL) — קריאת אימיילים מספקים
- **AI** (Lovable AI Gateway) — סיווג מסמכים אוטומטי
- **Google OAuth** — כניסה

---

# תכנון אינטגרציה עם SAP Business One

## מה זה SAP Business One?
SAP B1 הוא ERP לעסקים בינוניים המנהל: חשבונאות, רכש, מלאי, מכירות, ייצור, CRM. יש לו Service Layer — REST API שמאפשר גישה לכל ה-entities.

## נקודות חיבור מתבקשות

| מודול COBRA | Entity ב-SAP B1 | כיוון סנכרון |
|---|---|---|
| מוצרים | Items | דו-כיווני |
| ספקים | BusinessPartners (type=S) | דו-כיווני |
| הזמנות רכש | PurchaseOrders | COBRA → SAP |
| מלאי | InventoryGenEntries / ItemWarehouseInfo | SAP → COBRA |
| מסמכי רכש (PI) | PurchaseQuotations | SAP ↔ COBRA |
| תשלומים | VendorPayments / OutgoingPayments | SAP → COBRA |
| מחסנים | Warehouses | SAP → COBRA |

## ארכיטקטורה מוצעת

```text
┌─────────────┐     ┌──────────────────────┐     ┌───────────────┐
│  COBRA UI   │────▶│  Edge Functions       │────▶│  SAP B1       │
│  (React)    │◀────│  (sap-sync proxy)     │◀────│  Service Layer │
└─────────────┘     └──────────────────────┘     └───────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Lovable Cloud DB  │
                    │  (sync log table)  │
                    └───────────────────┘
```

### שלבי ביצוע

**שלב 1 — תשתית חיבור**
- שמירת credentials ב-secrets: `SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD`
- Edge function `sap-proxy` שמטפל ב-login/session ומעביר בקשות ל-Service Layer
- טבלת `sap_sync_log` למעקב אחרי סנכרונים

**שלב 2 — סנכרון מאסטר דאטה**
- משיכת פריטים (Items) מ-SAP ← מיפוי ל-products
- משיכת ספקים (BusinessPartners) מ-SAP ← מיפוי ל-suppliers
- משיכת מחסנים (Warehouses) מ-SAP ← מיפוי ל-distribution_centers
- הוספת עמודת `sap_code` לטבלאות products, suppliers, distribution_centers

**שלב 3 — סנכרון הזמנות**
- יצירת PO ב-SAP כשהזמנה עוברת לסטטוס "הוזמן"
- עדכון סטטוס ב-COBRA כש-PO ב-SAP מתעדכן
- שמירת sap_doc_entry ב-orders

**שלב 4 — סנכרון מלאי ותשלומים**
- משיכת יתרות מלאי מ-SAP לפי מחסן
- משיכת תשלומים שבוצעו מ-SAP

**שלב 5 — UI ניהול**
- עמוד הגדרות SAP: חיבור, סטטוס, trigger סנכרון ידני
- כפתור "סנכרן עכשיו" בעמודי מוצרים/ספקים/הזמנות
- חיווי ויזואלי: מסונכרן / לא מסונכרן / שגיאה
- לוג סנכרונים

## דרישות מהמשתמש
- גישה ל-SAP B1 Service Layer (URL, שם משתמש, סיסמא, שם DB)
- הגדרת מיפוי שדות (אם יש התאמות מיוחדות)

## פרטים טכניים
- SAP B1 Service Layer עובד עם session-based auth (Login → session cookie → logout)
- Edge function יעבוד כ-proxy: מתחבר ל-SAP, מבצע את הפעולה, מחזיר תוצאה
- סנכרון יכול להיות ידני (כפתור) או מתוזמן (cron/webhook)
- כל סנכרון נרשם בטבלת sap_sync_log

