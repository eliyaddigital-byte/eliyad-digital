/**
 * ============================================================
 *  הוכחות חברתיות – סיפורי הצלחה והמלצות
 * ============================================================
 *  חשוב: מוסיפים רק מידע אמיתי, עם אישור הלקוח לפרסום.
 *  פריט מוצג באתר רק כאשר verified: true.
 *  סקשן ללא פריטים מאומתים מוסתר אוטומטית.
 *
 *  ראו דוגמה מלאה (מוערת) בתחתית הקובץ ובקובץ CONTENT_GUIDE.md
 * ============================================================
 */

export type CaseStudy = {
  verified: boolean;
  /** שם הלקוח או תיאור אנונימי ("רשת קליניקות במרכז") – לפי מה שאושר */
  client: string;
  industry: string;
  logo?: string; // נתיב יחסי ב-public
  challenge: string;
  strategy: string;
  period?: string; // לדוגמה: 'ינואר–מרץ 2026'
  budget?: string; // לדוגמה: '25,000 ₪ לחודש'
  /** מדדים לפני/אחרי – רק מה שקיים ומאומת */
  metrics: { label: 'CPL' | 'CPA' | 'ROAS' | 'שיעור המרה' | string; before?: string; after: string }[];
  /** סדרת נתונים לגרף (לדוגמה: לידים לחודש). אופציונלי */
  chart?: { label: string; unit?: string; points: { x: string; y: number }[] };
  outcome: string;
};

export type Testimonial = {
  verified: boolean;
  /** אישור בכתב לפרסום התקבל? */
  consentToPublish: boolean;
  name: string;
  role: string;
  company?: string;
  quote: string;
  photo?: string; // נתיב יחסי ב-public
  logo?: string;
  videoUrl?: string; // קישור YouTube/Vimeo
};

export const caseStudies: CaseStudy[] = [
  // דוגמה – למחוק את סימני ההערה ולהחליף בנתונים אמיתיים בלבד:
  // {
  //   verified: true,
  //   client: 'שם הלקוח',
  //   industry: 'נדל"ן',
  //   challenge: 'מה היה האתגר',
  //   strategy: 'מה עשינו',
  //   period: 'ינואר–מרץ 2026',
  //   budget: '20,000 ₪ לחודש',
  //   metrics: [ { label: 'CPL', before: '180 ₪', after: '95 ₪' }, { label: 'ROAS', after: '4.2' } ],
  //   chart: { label: 'לידים איכותיים לחודש', points: [ { x: 'ינו', y: 40 }, { x: 'פבר', y: 62 }, { x: 'מרץ', y: 88 } ] },
  //   outcome: 'התוצאה העסקית במשפט אחד',
  // },
];

export const testimonials: Testimonial[] = [
  // {
  //   verified: true,
  //   consentToPublish: true,
  //   name: 'שם מלא',
  //   role: 'מנכ"ל',
  //   company: 'שם העסק',
  //   quote: 'ציטוט אמיתי מהלקוח',
  // },
];

export const publishedCases = caseStudies.filter((c) => c.verified);
export const publishedTestimonials = testimonials.filter((t) => t.verified && t.consentToPublish);
