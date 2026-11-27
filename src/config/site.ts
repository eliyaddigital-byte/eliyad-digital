/**
 * ============================================================
 *  BoostRize – קובץ ההגדרות המרכזי של האתר
 * ============================================================
 *  כאן משנים: שם המותג, פרטי קשר, רשתות חברתיות, מזהי מדידה,
 *  כתובת קבלת הלידים והגדרות הטופס.
 *
 *  כלל ברזל: שדה ריק ('') = הרכיב לא מוצג באתר.
 *  לא ממלאים פרטים שאינם אמיתיים.
 *
 *  ערכים שמתחילים ב-import.meta.env נלקחים ממשתני סביבה
 *  (קובץ .env מקומי או GitHub → Settings → Variables).
 *  ראו .env.example ו-CONTENT_GUIDE.md
 * ============================================================
 */

const env = import.meta.env;

export const site = {
  brand: {
    name: 'BoostRize',
    /** שם משפטי של העסק – יוצג בפוטר ובמסמכים המשפטיים. TODO: להשלים (למשל "אליעד דיגיטל" / ח.פ.) */
    legalName: '',
    tagline: 'שיווק ממומן שנמדד בלקוחות, לא בקליקים',
    description:
      'BoostRize היא סוכנות שיווק דיגיטלי לפרסום ממומן, אסטרטגיה, מדידה ואוטומציות – לעסקים שרוצים לחבר בין תקציב הפרסום לבין מכירות אמיתיות.',
    locale: 'he_IL',
    language: 'he',
    foundingYear: '', // TODO: להשלים רק אם רוצים להציג
  },

  /** פרטי קשר – כל שדה ריק פשוט לא יוצג באתר */
  contact: {
    phone: '', // לדוגמה: '050-0000000'  TODO
    whatsapp: '', // בפורמט בינלאומי בלי + ובלי מקפים, לדוגמה: '972500000000'  TODO
    whatsappMessage: 'היי BoostRize, אשמח לשמוע פרטים על ניהול קמפיינים לעסק שלי',
    email: '', // TODO
    address: '', // TODO (אופציונלי)
    hours: '', // לדוגמה: 'א׳–ה׳, 09:00–18:00'  TODO
  },

  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
  },

  /** קבלת לידים – כתובת ה-Backend (Cloudflare Worker / פונקציה אחרת). ריק = הטופס מוצג במצב "בקרוב" ולא מקבל פניות */
  leads: {
    endpoint: (env.PUBLIC_LEAD_ENDPOINT as string | undefined) ?? '',
    /** Cloudflare Turnstile site key (ציבורי). ריק = ללא Turnstile, נשארים Honeypot + בדיקת זמן + Rate limit בשרת */
    turnstileSiteKey: (env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) ?? '',
    /** גרסת הטופס – לשימוש ב-A/B testing (נשלח עם כל ליד ו-dataLayer) */
    formVariant: (env.PUBLIC_FORM_VARIANT as string | undefined) ?? 'multistep-v1',
    requireMarketingConsent: false, // הסכמה לדיוור היא תיבה נפרדת ואופציונלית
  },

  /** מדידה – הכל נטען רק אחרי הסכמה (Consent Mode v2). אין להכניס מזהים פיקטיביים */
  analytics: {
    gtmId: (env.PUBLIC_GTM_ID as string | undefined) ?? '', // GTM-XXXXXXX
    /** אם אין GTM – אפשר לטעון GA4 ישירות */
    ga4Id: (env.PUBLIC_GA4_ID as string | undefined) ?? '', // G-XXXXXXXXXX
    clarityId: (env.PUBLIC_CLARITY_ID as string | undefined) ?? '',
    /** אימות Google Search Console (meta tag) */
    googleSiteVerification: (env.PUBLIC_GSC_VERIFICATION as string | undefined) ?? '',
  },

  /** ניסויי A/B – מפתח → וריאציות. הווריאציה נבחרת בצד הלקוח ונשמרת ב-localStorage */
  experiments: {
    hero_headline: ['a', 'b'],
  } as Record<string, string[]>,

  cta: {
    primary: 'לתיאום שיחת אסטרטגיה',
    primaryShort: 'שיחת אסטרטגיה',
    secondary: 'איך אנחנו עובדים',
  },
} as const;

export type Site = typeof site;

export const whatsappUrl = site.contact.whatsapp
  ? `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(site.contact.whatsappMessage)}`
  : '';
export const telUrl = site.contact.phone ? `tel:${site.contact.phone.replace(/[^\d+]/g, '')}` : '';
export const mailUrl = site.contact.email ? `mailto:${site.contact.email}` : '';
export const hasDirectContact = Boolean(whatsappUrl || telUrl || mailUrl);
export const leadFormActive = Boolean(site.leads.endpoint);
