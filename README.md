# BoostRize – אתר סוכנות שיווק דיגיטלי

אתר תדמית מכירתי לסוכנות **BoostRize**: פרסום ממומן, מדידה ואוטומציה.
האתר בנוי כ-Static Site מהיר (Astro) ומתפרסם אוטומטית ל-GitHub Pages.

- **כתובת צפויה:** https://eliyaddigital-byte.github.io/eliyad-digital/
- **מאגר:** https://github.com/eliyaddigital-byte/eliyad-digital

## מה יש באתר

| עמוד | נתיב | הערות |
|---|---|---|
| עמוד בית מכירתי | `/` | Hero עם A/B, פלטפורמות, כאבים, 14 שירותים בטאבים, תוצאות ושקיפות, תהליך עבודה, יתרונות, למי זה מתאים, אודות, VSL*, המלצות*, FAQ, טופס לידים רב-שלבי |
| עמוד תודה | `/thank-you/` | noindex. כאן נשלח `generate_lead` (פעם אחת לכל ליד) |
| מדיניות פרטיות / תנאי שימוש / הצהרת נגישות | `/privacy/` `/terms/` `/accessibility/` | **טיוטות** שדורשות בדיקת עורך דין |
| 404 | `/404.html` | |
| sitemap / robots | `/sitemap-index.xml` `/robots.txt` | נוצרים אוטומטית |

\* סקשנים שמוצגים **רק** כשיש תוכן אמיתי ומאומת: סרטון VSL, המלצות, סיפורי הצלחה ותמונת מייסד.

## טכנולוגיות

- **Astro 7** (Static output) + TypeScript. אין React, כי לא נדרש: כל האינטראקציה היא סקריפטים קטנים ב-vanilla TS (פחות JS ומהירות גבוהה יותר)
- CSS מודרני עם Design Tokens (ללא Tailwind, כדי לשמור על CSS קטן וקריא). ראו [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- פונט **Rubik Variable**, מאוחסן עצמאית (Fontsource), עם עברית ולטינית
- אייקונים בסגנון Lucide (ISC) מוטמעים inline
- `@astrojs/sitemap`
- Backend ללידים: **Cloudflare Worker** (`backend/lead-worker`)
- QA: Playwright + axe-core

## התחלה מהירה

```bash
npm install
npm run dev        # http://localhost:4321/eliyad-digital/
npm run build      # בנייה ל-dist/
npm run preview    # תצוגה של ה-build
```

### בדיקות

```bash
npm run build && npm run preview          # טרמינל 1
npm run qa                                # צילומי מסך + נגישות + קישורים + אינטראקציות → qa-output/

# בדיקת טופס מקצה לקצה (Worker אמיתי, מקומי):
npm run leads:dev                         # טרמינל 2 → http://localhost:8787
PUBLIC_LEAD_ENDPOINT=http://localhost:8787/ npm run build && npm run preview
npm run qa:form
```

## איפה משנים מה

| מה | קובץ |
|---|---|
| שם מותג, טלפון, וואטסאפ, מייל, רשתות, מזהי מדידה | `src/config/site.ts` (ומשתני סביבה, ראו `.env.example`) |
| כל הטקסטים בעמוד הבית | `src/content/home.ts` |
| סיפורי הצלחה והמלצות | `src/content/proof.ts` |
| צבעים, פונטים, ריווחים | `src/styles/global.css` |
| לוגו | `src/components/Logo.astro`, `public/brand/` |

מדריך מפורט ללא ידע בקוד: [CONTENT_GUIDE.md](CONTENT_GUIDE.md)

## תיעוד

- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): שפה עיצובית, צבעים, טיפוגרפיה ורכיבים
- [TRACKING_PLAN.md](TRACKING_PLAN.md): אירועי dataLayer, המרות, GTM ו-Consent Mode
- [INTEGRATIONS.md](INTEGRATIONS.md): Backend ללידים, Monday, HubSpot, Make, Zapier, Sheets, מייל ו-WhatsApp
- [DEPLOYMENT.md](DEPLOYMENT.md): GitHub Pages, משתני סביבה ודומיין אישי
- [CONTENT_GUIDE.md](CONTENT_GUIDE.md): עדכון תוכן
- [QA_REPORT.md](QA_REPORT.md): תוצאות בדיקות

## עקרונות שלא מוותרים עליהם

1. לא ממציאים לקוחות, מספרים, המלצות או הסמכות. כל מידע כזה מוצג רק כשהוא מאומת.
2. אין סודות בקוד. מפתחות API וכתובות Webhook נשמרים רק ב-Worker.
3. הטופס מציג "הצלחה" רק אחרי שהשרת אישר קבלה. בלי Backend, הטופס מוצג במצב "בקרוב".
4. מעקב נטען רק אחרי הסכמה (Consent Mode v2), ובלי PII ב-GA4.
