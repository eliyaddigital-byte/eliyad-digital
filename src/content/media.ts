/**
 * ============================================================
 *  מקומות למדיה (תמונות וסרטונים) באתר
 * ============================================================
 *  לכל מקום יש מספר. בעמוד התצוגה /media-preview/ כל המקומות
 *  מוצגים עם סרטון הדוגמה ותווית, כדי לבחור מה לשים בכל אחד.
 *
 *  כדי למלא מקום באתר האמיתי: מעלים קובץ לתיקייה public/media
 *  וכותבים את שמו בשדה file (למשל 'founder.webp' או 'intro-720.mp4').
 *  מקום שהשדה file שלו ריק – לא מוצג באתר הציבורי.
 * ============================================================
 */

export type MediaSlot = {
  n: number;
  id: string;
  label: string; // מה כדאי לשים כאן
  kind: 'video' | 'image' | 'either';
  aspect: string; // יחס תצוגה, לדוגמה '16 / 9'
  file: string; // קובץ ב-public/media (ריק = לא מוצג באתר)
  poster?: string; // לסרטון: תמונת פתיחה ב-public/media
};

/** סרטון הדוגמה שמוצג בכל המקומות בעמוד התצוגה */
export const previewMedia = { file: 'intro-720.mp4', poster: 'intro-poster.jpg' };

export const mediaSlots: MediaSlot[] = [
  { n: 1, id: 'hero', label: 'ויז׳ואל ראשי ליד הכותרת: סרטון קצר שלך או של העבודה', kind: 'either', aspect: '4 / 5', file: '' },
  { n: 2, id: 'vsl', label: 'סרטון היכרות / מכירה (VSL): 1–3 דקות, אתה מדבר אל המצלמה', kind: 'video', aspect: '16 / 9', file: '', poster: '' },
  { n: 3, id: 'dashboard', label: 'צילום מסך אמיתי של דשבורד או דוח ביצועים (בלי שמות לקוחות)', kind: 'image', aspect: '16 / 10', file: '' },
  { n: 4, id: 'process', label: 'תמונה מעבודה: פגישת אסטרטגיה, עבודה מול המחשב, הצוות', kind: 'either', aspect: '4 / 3', file: '' },
  { n: 5, id: 'founder', label: 'תמונה שלך (או סרטון קצר) לאזור האודות', kind: 'either', aspect: '4 / 5', file: '' },
  { n: 6, id: 'testimonial-1', label: 'סרטון המלצה של לקוח #1', kind: 'video', aspect: '9 / 16', file: '' },
  { n: 7, id: 'testimonial-2', label: 'סרטון המלצה של לקוח #2', kind: 'video', aspect: '9 / 16', file: '' },
  { n: 8, id: 'testimonial-3', label: 'סרטון המלצה של לקוח #3', kind: 'video', aspect: '9 / 16', file: '' },
  { n: 9, id: 'case', label: 'תוצאות לקוח: צילום מסך של קמפיין או גרף לפני/אחרי', kind: 'image', aspect: '16 / 10', file: '' },
  { n: 10, id: 'contact', label: 'תמונה קטנה שלך ליד יצירת הקשר ("תדברו איתי ישירות")', kind: 'image', aspect: '1 / 1', file: '' },
];

export const slot = (id: string) => mediaSlots.find((s) => s.id === id)!;
