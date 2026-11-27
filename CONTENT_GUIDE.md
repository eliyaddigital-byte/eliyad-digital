# מדריך עדכון תוכן (בלי ידע בתכנות)

הכי פשוט: לערוך את הקבצים ישירות באתר GitHub (סמל העיפרון ✏️ → Commit). האתר נבנה ומתעדכן לבד תוך כ-2 דקות.

> טיפ: בקבצים, משנים רק את הטקסט שבין המירכאות `'...'`. לא מוחקים פסיקים, סוגריים או מירכאות.

## 1. פרטי קשר ורשתות: `src/config/site.ts`
```ts
contact: {
  phone: '050-1234567',
  whatsapp: '972501234567',     // בלי + ובלי מקפים
  email: 'hello@boostrize.co.il',
  ...
},
social: { instagram: 'https://instagram.com/...', ... }
```
שדה ריק `''` = לא מוצג באתר. ברגע שממלאים, הכפתורים מופיעים בכל המקומות הרלוונטיים.

גם `brand.legalName` (שם משפטי ומספר עוסק) מופיע בפוטר ובמסמכים המשפטיים.

## 2. טקסטים: `src/content/home.ts`
כל סקשן הוא בלוק נפרד (`hero`, `pains`, `services`, `faqSection` …).
- **הדגשת מרקר כתום:** עוטפים מילים ב-`[[ ]]`, למשל `'שותף לצמיחה, [[לא עוד ספק]]'`
- **שירות חדש:** מעתיקים שורה בתוך `services` ומשנים. `category` הוא `'ads'`, `'growth'` או `'data'`
- **שאלה חדשה:** מוסיפים `{ q: 'שאלה', a: 'תשובה' }` ל-`faqSection.items`
- **אייקונים זמינים:** `target, search, users, play, briefcase, cart, compass, funnel, gauge, layout, chart, dashboard, zap, plug, eye, fingerprint, handshake, refresh, filter, cpu, flame, phone-off, trending-up, box, calculator, ceiling, split, shield, clock, sparkles`

## 3. סיפורי הצלחה והמלצות: `src/content/proof.ts`
יש דוגמה מוערת בקובץ. פריט מוצג **רק** כש-`verified: true`, ובהמלצות גם `consentToPublish: true`.
סיפור הצלחה תומך ב: תחום, אתגר, אסטרטגיה, תקופה, תקציב, מדדים לפני/אחרי (CPL/CPA/ROAS/המרה), גרף ותוצאה.
**חשוב:** רק נתונים אמיתיים, באישור הלקוח.

## 4. תמונות
מעלים ל-`public/images/` (מומלץ WebP, עד 300KB) ומפנים בנתיב יחסי, למשל `'images/team/founder.webp'`.
- תמונת מייסד: `aboutSection.founder.image` (וגם `name`, `role`). כשיש תמונה, היא מחליפה את הגרפיקה
- לוגו לקוח: שדה `logo` ב-proof.ts

## 5. סרטון VSL: `src/content/home.ts` → `video`
```ts
export const video = { enabled: true, provider: 'youtube', id: 'dQw4w9WgXcQ', poster: '', title: '...', eyebrow: '...' };
```
`provider`: `youtube` (מזהה מה-URL), `vimeo` (מספר), או `file` (נתיב ב-public). עד שמוגדר, הסקשן מוסתר.

## 6. מדידה וטופס
מגדירים ב-GitHub Variables (ראו [DEPLOYMENT.md](DEPLOYMENT.md)). אין צורך לגעת בקוד.

## 7. צבעים ופונטים
`src/styles/global.css` → בלוק `:root`. למשל `--orange: #f37a1f;`.

## 8. CMS בעתיד
כל התוכן כבר מרוכז בקבצי TS/JSON. כדי לאפשר עריכה בממשק גרפי אפשר לחבר CMS מבוסס Git (למשל Decap CMS או TinaCMS), בלי שינוי במבנה העמודים: מעבירים את `home.ts` לקובצי JSON שה-CMS עורך.

## עמודי שירות ומאמרים (תשתית)
מבנה ה-URL מוכן: `/services/<slug>/` (ה-slug מוגדר לכל שירות). כדי לא לפרסם תוכן דל, עמודים יתווספו רק כשיהיה לכל שירות תוכן ייחודי ומעמיק (מומלץ 800+ מילים, דוגמאות ושאלות נפוצות ייעודיות).
