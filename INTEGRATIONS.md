# Integrations – קבלת לידים וחיבור מערכות

## למה צריך Backend
GitHub Pages מגיש קבצים סטטיים בלבד. כדי לקבל לידים בלי לחשוף כתובות Webhook או מפתחות API בקוד הציבורי, הטופס שולח לנקודת קצה מאובטחת: **Cloudflare Worker** (`backend/lead-worker/`). ב-Worker נשמרים כל הסודות.

```
דפדפן ──POST JSON──▶ Cloudflare Worker ──▶ KV (ארכיון, מניעת כפילויות, Rate limit)
                                       ├─▶ Make / Zapier / Webhook כלשהו
                                       ├─▶ Google Sheets (Apps Script)
                                       ├─▶ Monday.com (GraphQL API)
                                       ├─▶ HubSpot (CRM API)
                                       ├─▶ מייל (Resend)
                                       └─▶ WhatsApp Cloud API (התראה)
```

**מצב נוכחי:** ה-Worker כתוב ונבדק מקומית (`npm run leads:dev` ו-`npm run qa:form`), אבל **לא הועלה לחשבון Cloudflare**, כי אין גישה לחשבון. עד שמגדירים `PUBLIC_LEAD_ENDPOINT`, הטופס באתר מוצג במצב "בקרוב" ולא מקבל פניות.

## הקמה (כ-15 דקות)
1. פתיחת חשבון Cloudflare (חינמי)
2. בתיקייה `backend/lead-worker`:
   ```bash
   npm install
   cp wrangler.toml.example wrangler.toml
   npx wrangler login
   npx wrangler kv namespace create LEADS_KV        # מדביקים את ה-id ב-wrangler.toml
   npx wrangler deploy                               # מקבלים כתובת: https://boostrize-leads.<account>.workers.dev
   ```
3. מגדירים לפחות יעד אחד (ראו למטה) עם `npx wrangler secret put NAME`
4. ב-GitHub: Settings → Secrets and variables → Actions → **Variables** → `PUBLIC_LEAD_ENDPOINT` = כתובת ה-Worker
5. מריצים מחדש את ה-workflow (או עושים push), והטופס הופך לפעיל

> ה-Worker **מסרב** לאשר ליד (503) אם לא הוגדר אף יעד, כדי שלא יוצג "תודה" על פנייה שלא נשמרה.

## חוזה ה-API
`POST /` עם `Content-Type: application/json`

```json
{
  "lead_id": "uuid", "name": "", "phone": "05XXXXXXXX", "email": "",
  "business": "", "website": "", "industry": "", "budget": "", "goal": "",
  "marketing_consent": false, "form_variant": "multistep-v1",
  "experiments": { "hero_headline": "a" },
  "attribution": { "landing_page": "", "page_url": "", "referrer": "",
    "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_content": "", "utm_term": "",
    "gclid": "", "fbclid": "", "ttclid": "" },
  "hp": "", "elapsed_ms": 12000, "turnstile_token": ""
}
```
תשובות: `200 {ok:true, lead_id}` · `200 {ok:true, duplicate:true}` · `422 {fields:[…]}` · `429` · `403` · `503/502`

### הליד שנשלח ליעדים (שטוח)
`lead_id, created_at, name, phone, email, business, website, industry, budget, goal, marketing_consent, form_variant, experiments, source, landing_page, page_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, gbraid, wbraid, fbclid, ttclid, li_fat_id, msclkid, user_agent, country`

## אבטחה מובנית
- ולידציה בצד לקוח **ובצד שרת**. ניקוי תווי HTML ותווי בקרה, והגבלת אורך לכל שדה
- Honeypot ובדיקת זמן מילוי מינימלי (בוט מקבל "הצלחה" מזויפת ולא נשמר)
- Cloudflare Turnstile (אופציונלי): `TURNSTILE_SECRET` ב-Worker ו-`PUBLIC_TURNSTILE_SITE_KEY` באתר
- Rate limit לפי IP מגובב (ברירת מחדל: 5 בשעה)
- CORS מוגבל ל-`ALLOWED_ORIGINS`
- מניעת כפילויות: אותו `lead_id`, או אותו טלפון+מייל בתוך `DEDUPE_WINDOW_HOURS`. הסימון נשמר רק אחרי מסירה מוצלחת
- חתימת HMAC על Webhooks (`X-Signature-SHA256`) אם מוגדר `WEBHOOK_SECRET`
- ארכיון ב-KV לחצי שנה (גיבוי גם אם יעד חיצוני נפל)

## יעדים

### Make.com / Zapier / כל Webhook
`npx wrangler secret put WEBHOOK_URLS`: כתובת אחת או יותר, מופרדות בפסיק.
- Make: Scenario חדש → Webhooks → Custom webhook → מעתיקים את הכתובת
- Zapier: Webhooks by Zapier → Catch Hook
משם אפשר לפזר לכל מערכת (Monday, HubSpot, WhatsApp, Slack, Sheets וכו') בלי קוד.

### Google Sheets
1. גיליון חדש → Extensions → Apps Script → מדביקים:
```js
function doPost(e) {
  const lead = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActive().getSheetByName('Leads') || SpreadsheetApp.getActive().insertSheet('Leads');
  const cols = ['created_at','lead_id','name','phone','email','business','website','industry','budget','goal','marketing_consent','utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','landing_page','referrer'];
  if (sh.getLastRow() === 0) sh.appendRow(cols);
  sh.appendRow(cols.map(c => lead[c] ?? ''));
  return ContentService.createTextOutput('ok');
}
```
2. Deploy → Web app → Execute as: Me, Access: Anyone → מעתיקים את ה-URL
3. `npx wrangler secret put SHEETS_WEBHOOK_URL`

### Monday.com CRM
- `MONDAY_API_TOKEN` (Profile → Developers → My access tokens), `MONDAY_BOARD_ID` (מספר הלוח מה-URL), `MONDAY_GROUP_ID` (אופציונלי)
- `MONDAY_COLUMN_MAP`: מיפוי שדות ל-Column IDs, לדוגמה:
  `{"phone":"phone_mkx1","email":"email_mkx2","business":"text_mkx3","utm_source":"text_mkx4","utm_campaign":"text_mkx5","budget":"text_mkx6","lead_id":"text_mkx7"}`
  (את ה-Column ID רואים בתפריט העמודה → Copy column ID. עמודות phone ו-email מזוהות לפי הקידומת)

### HubSpot
- Private App עם הרשאה `crm.objects.contacts.write` → `HUBSPOT_TOKEN`
- יוצר איש קשר, או מעדכן לפי מייל אם הוא כבר קיים. לשמירת UTM ב-HubSpot: יוצרים Custom properties ומרחיבים את `toHubSpot`.

### התראה במייל (Resend)
`RESEND_API_KEY`, `NOTIFY_EMAIL_TO` (אפשר כמה נמענים בפסיקים), `NOTIFY_EMAIL_FROM` (כתובת מדומיין מאומת ב-Resend)

### WhatsApp Business (Cloud API)
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_NOTIFY_TO` (מספר בפורמט 9725XXXXXXXX)
- הודעה יזומה מחייבת **Template מאושר**. ברירת מחדל: `new_lead_alert` בעברית עם 4 פרמטרים (שם, טלפון, עסק, מקור). אפשר לשנות דרך `WHATSAPP_TEMPLATE`
- חלופה פשוטה: התראת WhatsApp דרך Make/Zapier

### כפתור WhatsApp באתר
`contact.whatsapp` ב-`src/config/site.ts` (פורמט `9725XXXXXXXX`). הכפתור מופיע אוטומטית בסקשן יצירת קשר, ב-FAQ, בפוטר, ב-Sticky CTA במובייל ובעמוד התודה.

## בדיקה מקומית
```bash
npm run leads:dev                                   # מריץ את קוד ה-Worker האמיתי ב-Node, עם KV בזיכרון
PUBLIC_LEAD_ENDPOINT=http://localhost:8787/ npm run build && npm run preview
npm run qa:form                                     # בדיקת טופס, תודה, כפילויות, honeypot, CORS, XSS
```
