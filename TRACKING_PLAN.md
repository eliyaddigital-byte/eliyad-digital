# Tracking Plan – BoostRize

## ארכיטקטורה
- כל האירועים נדחפים ל-`window.dataLayer` (`src/scripts/tracking.ts`).
- **GTM הוא הדרך המומלצת**: כל התגים (GA4, Google Ads, Meta Pixel, TikTok Pixel, LinkedIn Insight) מוגדרים בתוך GTM ומופעלים לפי האירועים כאן.
- **Consent Mode v2 (Basic):** ברירת מחדל `denied` לכל ארבעת הסיגנלים. GTM, GA4 ו-Clarity **לא נטענים כלל** עד שהמשתמש מאשר בבאנר. אחרי בחירה נשלח `gtag('consent','update',…)` ואירוע `consent_update`.
  - רוצים Advanced Mode (טעינת GTM עם denied ופינגים ללא עוגיות)? משנים את `applyConsent` כך שיטען GTM תמיד. מומלץ להתייעץ קודם לגבי הדין הישראלי וה-GDPR.
- **אין PII** ב-dataLayer: לא שם, טלפון או מייל. מזהה הליד (`lead_id`) הוא UUID אקראי.
- הבאנר מופיע רק כשמוגדר לפחות אחד מ-`PUBLIC_GTM_ID` / `PUBLIC_GA4_ID` / `PUBLIC_CLARITY_ID`.

## אירועים

| אירוע | טריגר | פרמטרים | המרה? |
|---|---|---|---|
| `page_view` | טעינת עמוד (אחרי הסקריפט) | `page_path`, `page_title` | לא. מיועד לפיקסלים (Meta PageView וכו'). ב-GA4 תג Google שולח page_view בעצמו, ולכן **לא** ממפים את האירוע הזה ל-GA4 כדי לא לספור כפול |
| `experiment_impression` | הצגת וריאנט A/B | `experiment_id`, `variant_id` | לא |
| `cta_click` | לחיצה על כפתור עם `data-cta` | `cta_id`, `cta_text`, `click_location` | לא (מיקרו) |
| `form_start` | פוקוס ראשון בטופס | `form_id`, `form_variant` | לא (מיקרו) |
| `form_step_completed` | מעבר משלב 1 לשלב 2 | `form_id`, `form_variant`, `form_step` | לא (מיקרו) |
| `form_error` | שגיאת ולידציה, שרת או רשת | `form_id`, `form_step`, `error_field`, `error_type` (`validation` / `server_validation` / `rate_limited` / `network`) | לא |
| `generate_lead` | **בעמוד התודה**, רק אם השרת החזיר `ok:true`. פעם אחת לכל `lead_id` (נשמר ב-localStorage) | `lead_id`, `form_id`, `form_variant`, `lead_budget_range`, `lead_industry`, `currency` | **כן, ההמרה הראשית** |
| `whatsapp_click` | לחיצה על קישור wa.me | `click_location` | כן (משני) |
| `phone_click` | לחיצה על `tel:` | `click_location` | כן (משני) |
| `email_click` | לחיצה על `mailto:` | `click_location` | לא |
| `video_start` / `video_complete` | הפעלת VSL / סיום (complete נמדד בקובץ עצמי בלבד; ל-YouTube יש להפעיל את טריגר YouTube של GTM) | `video_title`, `video_provider` | לא |
| `scroll_depth` | 25/50/75/90% | `percent_scrolled` | לא |
| `service_tab` | החלפת טאב שירותים | `tab_id` | לא |
| `faq_open` | פתיחת שאלה | `faq_question` | לא |
| `consent_update` | בחירה בבאנר | `consent_analytics`, `consent_marketing` | לא |

## מניעת ספירה כפולה
1. `generate_lead` נשלח בעמוד התודה, ולא בעת הלחיצה. רענון העמוד לא שולח שוב (הנתון נמחק מ-sessionStorage, ו-`lead_id` מסומן ב-localStorage).
2. השרת מזהה שליחה כפולה (אותו `lead_id` או אותו טלפון+מייל בחלון של 24 שעות) ולא מפיץ שוב.
3. ב-GTM: להשתמש ב-`lead_id` כ-**Transaction ID** בהמרת Google Ads וכ-**event_id** ב-Meta Pixel. אותו `event_id` נשלח גם ב-Conversions API, ו-Meta מבצע deduplication.

## הגדרת GTM מומלצת
- **Variables (Data Layer):** `lead_id`, `form_id`, `form_variant`, `cta_id`, `click_location`, `percent_scrolled`, `experiment_id`, `variant_id`
- **Triggers (Custom Event):** `generate_lead`, `whatsapp_click`, `phone_click`, `cta_click`, `form_start`, `form_step_completed`, `scroll_depth`, `page_view`
- **Tags:**
  - Google Tag (GA4): Initialization – All Pages
  - GA4 Event: `{{Event}}` לכל האירועים חוץ מ-`page_view`
  - Google Ads Conversion: על `generate_lead`, Transaction ID = `{{lead_id}}`, עם Conversion Linker
  - Meta Pixel: `PageView` על `page_view`, `Lead` על `generate_lead` עם `eventID: {{lead_id}}`, `Contact` על whatsapp/phone
  - TikTok Pixel: `SubmitForm` על `generate_lead` (event_id = lead_id)
  - LinkedIn Insight + Conversion על `generate_lead`
  - Microsoft Clarity: דרך `PUBLIC_CLARITY_ID` (נטען אחרי הסכמה לסטטיסטיקה), או דרך GTM
- ב-GA4 לסמן את `generate_lead` כ-**Key event**.

## Meta Conversions API / Offline conversions
ה-Worker שומר לכל ליד את `fbclid`, `gclid`, `gbraid`, `wbraid`, `ttclid`, `li_fat_id` ו-UTM, **רק אם ניתנה הסכמה שיווקית**. בלי הסכמה, מזהי הקליק מוסרים גם מכתובות ה-URL שנשמרות. שתי דרכים לשליחת CAPI:
- דרך Make/Zapier: מה-Webhook של הליד → מודול "Meta Conversions API" עם `event_id = lead_id`, ו-email/phone מגובבים (SHA-256), כנדרש.
- סגירת עסקה ב-CRM → "Offline conversion" ל-Google Ads (עם gclid) ול-Meta. הנתונים כבר שמורים בכל ליד.

## A/B Testing
- `site.experiments` ב-`src/config/site.ts` מגדיר ניסויים. כרגע: `hero_headline` עם הווריאנטים `a` ו-`b` (הטקסטים ב-`hero.headlines`).
- הווריאנט נבחר אקראית ונשמר ב-localStorage. אפשר לכפות וריאנט עם `?ab_hero_headline=b`.
- הווריאנט נשלח ב-`experiment_impression` ונשמר גם על כל ליד (`experiments`), כך שאפשר להשוות **לידים ואיכות**, לא רק קליקים.
- `PUBLIC_FORM_VARIANT` מסמן גרסת טופס.
