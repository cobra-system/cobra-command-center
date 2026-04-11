# Backlog — COBRA Command Center

> פריטים פתוחים שטרם בוצעו.
> עדיפות: 🔴 קריטי | 🟠 גבוה | 🟡 בינוני | 🟢 נמוך
> סטטוס: `[ ]` לא התחיל | `[~]` בתהליך | `[x]` הושלם

---

## תכונות חסרות

- [ ] **Docker setup for local development** 🟡
  - Docker Compose עם Supabase local + frontend
  - _נדחה — דורש הגדרת Supabase local_

- [ ] **Email/SMS notifications system** 🟡
  - Edge Function לשליחת התראות (SendGrid / Resend)
  - טריגרים: ציות פג תוקף, הזמנות מאוחרות, שיוך משימות, מלאי נמוך
  - העדפות התראות לפי משתמש בהגדרות
  - טבלת `notification_templates` להתאמה אישית

- [ ] **Bulk data import (CSV/Excel)** 🟡
  - ייבוא CSV/Excel עבור: מוצרים, ספקים, מלאי
  - קומפוננט `ImportDialog` עם העלאת קובץ, מיפוי עמודות, תצוגה מקדימה
  - שימוש ב-`papaparse` ל-CSV ו-`xlsx` ל-Excel
  - הצגת שגיאות לפני ייבוא, אפשרות ייבוא חלקי

- [ ] **Universal data export (CSV/Excel)** 🟡
  - כיום יש ייצוא PDF בחלק מהמקומות בלבד
  - הוספת ייצוא CSV/Excel לכל טבלאות הנתונים: מוצרים, הזמנות, ספקים, משימות, מלאי
  - יצירת `src/lib/exportUtils.ts` עם פונקציות ייצוא לשימוש חוזר
  - הייצוא ישקף את הסינון הנוכחי (מה שהמשתמש רואה)

- [ ] **Progressive Web App (PWA)** 🟢
  - הוספת `vite-plugin-pwa` להגדרות ה-build
  - Service Worker לקאש offline של assets סטטיים
  - `manifest.json` עם metadata ואייקונים
  - גישה offline לנתונים שנצפו לאחרונה

- [ ] **Two-Factor Authentication (2FA)** 🟡
  - תמיכה ב-TOTP (תואם Google Authenticator / Authy)
  - תהליך הגדרת 2FA בדף ההגדרות
  - שמירת TOTP secrets בצורה מאובטחת ב-Supabase
  - חובת 2FA לחשבונות עם תפקיד MANAGER

- [ ] **Webhook/Integration API** 🟢
  - REST API endpoints לאינטגרציה עם מערכות חיצוניות
  - תמיכה ב-webhook subscriptions לאירועים: שינוי סטטוס הזמנה, עדכון מלאי, תקלה חדשה
  - אימות API Key לצרכנים חיצוניים
  - תיעוד API עם מפרט OpenAPI/Swagger
