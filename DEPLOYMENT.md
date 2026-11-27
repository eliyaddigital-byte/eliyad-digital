# Deployment – GitHub Pages

## איך זה עובד
`.github/workflows/deploy.yml`:
- **Pull Request ל-main:** בנייה ובדיקות בלבד (בלי פרסום)
- **Push ל-main** (או הרצה ידנית): בנייה, בדיקות ופרסום ל-GitHub Pages

## הפעלה חד-פעמית (דורש הרשאת Admin במאגר)
1. https://github.com/eliyaddigital-byte/eliyad-digital/settings/pages
2. **Build and deployment → Source: GitHub Actions**
3. ממזגים את הענף `feat/boostrize-site` ל-`main` (או מריצים את ה-workflow ידנית מ-main)
4. אחרי כדקה וחצי האתר זמין בכתובת: https://eliyaddigital-byte.github.io/eliyad-digital/

## משתני סביבה (Settings → Secrets and variables → Actions → Variables)
| משתנה | חובה? | תיאור |
|---|---|---|
| `PUBLIC_LEAD_ENDPOINT` | כדי שהטופס יפעל | כתובת ה-Cloudflare Worker |
| `PUBLIC_GTM_ID` | מומלץ | GTM-XXXXXXX |
| `PUBLIC_GA4_ID` | אם אין GTM | G-XXXXXXXXXX |
| `PUBLIC_CLARITY_ID` | אופציונלי | Microsoft Clarity |
| `PUBLIC_GSC_VERIFICATION` | אופציונלי | קוד אימות Search Console (meta) |
| `PUBLIC_TURNSTILE_SITE_KEY` | אופציונלי | Cloudflare Turnstile |
| `SITE_URL` / `BASE_PATH` | לדומיין אישי | ראו למטה |

אלה ערכים **ציבוריים**. סודות (מפתחות API) לא נשמרים ב-GitHub אלא רק ב-Worker.

## דומיין אישי
1. אצל רשם הדומיין: רשומת `CNAME` עבור `www` → `eliyaddigital-byte.github.io`. לדומיין הראשי (apex): רשומות `A` ל-185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
2. GitHub → Settings → Pages → Custom domain → `www.your-domain.co.il` → Enforce HTTPS
3. Variables: `SITE_URL=https://www.your-domain.co.il`, `BASE_PATH=/`
4. מוסיפים את הדומיין ל-`ALLOWED_ORIGINS` של ה-Worker
5. Push או הרצה ידנית של ה-workflow

## Google Search Console
1. Add property → URL prefix → כתובת האתר
2. HTML tag → מעתיקים את ה-content ל-`PUBLIC_GSC_VERIFICATION` → בנייה מחדש → Verify
3. Sitemaps → `sitemap-index.xml`

## אבטחה ו-HTTPS
GitHub Pages מגיש HTTPS אוטומטית. כותרות אבטחה מתקדמות (CSP, HSTS מותאם) אינן ניתנות להגדרה ב-GitHub Pages. אם יידרשו, אפשר להעביר את האירוח ל-Cloudflare Pages (אותו build, עם קובץ `_headers`).
