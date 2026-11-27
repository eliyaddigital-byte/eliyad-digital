/**
 * BoostRize – שאלון "איפה השיווק נתקע" → Google Sheets
 * ------------------------------------------------------------------
 * כותב כל מילוי של הטופס באתר כשורה בלשונית "BoostRize - אבחון שיווקי",
 * לפי שמות העמודות בשורה הראשונה (אפשר להזיז עמודות – הכתיבה לפי השם).
 * בנוסף שולח התראת מייל לבעל הגיליון (אפשר לכבות: NOTIFY = false).
 *
 * התקנה (פעם אחת, כ-2 דקות):
 *  1. בגיליון: Extensions → Apps Script
 *  2. מוחקים את מה שיש ומדביקים את כל הקובץ הזה → שמירה (Ctrl+S)
 *  3. Deploy → New deployment → ⚙ Web app
 *     Execute as: Me  |  Who has access: Anyone  → Deploy → Authorize
 *  4. מעתיקים את ה-Web app URL ושולחים ל-Claude (או מדביקים ב-src/config/site.ts → leads.sheetEndpoint)
 */

const SHEET_NAME = 'BoostRize - אבחון שיווקי';
const NOTIFY = true; // מייל לבעל הגיליון על כל ליד חדש

// מפתח בשורת הבקשה → שם העמודה בגיליון
const MAP = {
  created_at: 'תאריך ושעה',
  name: 'שם מלא',
  phone: 'טלפון',
  status: 'סטטוס ליד',
  stuck: 'איפה השיווק נתקע',
  improve: 'מה רוצים לשפר',
  budget_planned: 'תקציב פרסום חודשי מתוכנן',
  budget_now: 'תקציב פרסום חודשי היום',
  instagram: 'אינסטגרם',
  facebook: 'פייסבוק',
  website: 'אתר',
  other_assets: 'נכסים נוספים',
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_content: 'content',
  utm_term: 'term',
  landing_page: 'דף נחיתה',
  lead_id: 'מזהה ליד',
};

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // הגנות בסיסיות נגד בוטים וספאם
    if (d.hp) return out_({ ok: true });
    if (typeof d.elapsed_ms === 'number' && d.elapsed_ms < 2500) return out_({ ok: true });
    const name = clean_(d.name, 80);
    const phone = String(d.phone || '').replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
    if (name.length < 2 || !/^0(5\d|[23489]|7\d)\d{7}$/.test(phone)) return out_({ ok: false, error: 'validation_failed' });

    const row = {
      created_at: new Date(),
      name: name,
      phone: phone,
      status: 'חדש',
      stuck: list_(d.stuck),
      improve: list_(d.improve),
      budget_planned: clean_(d.budget_planned, 60),
      budget_now: clean_(d.budget_now, 60),
      instagram: clean_(d.instagram, 300),
      facebook: clean_(d.facebook, 300),
      website: clean_(d.website, 300),
      other_assets: clean_(d.other_assets, 500),
      utm_source: clean_(d.utm_source, 200),
      utm_medium: clean_(d.utm_medium, 200),
      utm_campaign: clean_(d.utm_campaign, 200),
      utm_content: clean_(d.utm_content, 200),
      utm_term: clean_(d.utm_term, 200),
      landing_page: clean_(d.landing_page, 500),
      lead_id: clean_(d.lead_id, 64),
    };

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet_();
      const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      // מניעת כפילות לפי מזהה ליד
      const idCol = headers.indexOf(MAP.lead_id) + 1;
      if (idCol > 0 && row.lead_id && sh.getLastRow() > 1) {
        const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues().flat();
        if (ids.indexOf(row.lead_id) !== -1) return out_({ ok: true, duplicate: true });
      }
      const values = headers.map((h) => {
        const key = Object.keys(MAP).find((k) => MAP[k] === h);
        return key ? row[key] : '';
      });
      sh.appendRow(values);
    } finally {
      lock.releaseLock();
    }
    if (NOTIFY) notify_(row);
    return out_({ ok: true, lead_id: row.lead_id });
  } catch (err) {
    console.error(err);
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, service: 'boostrize-quiz' });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['תאריך ושעה', 'שם מלא', 'טלפון', 'סטטוס ליד', 'הערות'].concat(
      ['איפה השיווק נתקע', 'מה רוצים לשפר', 'תקציב פרסום חודשי מתוכנן', 'תקציב פרסום חודשי היום', 'אינסטגרם', 'פייסבוק', 'אתר', 'נכסים נוספים', 'source', 'medium', 'campaign', 'content', 'term', 'דף נחיתה', 'מזהה ליד']));
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

// מניעת הזרקת נוסחאות לגיליון (= + - @) והגבלת אורך
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function list_(v) {
  return (Array.isArray(v) ? v : [v]).filter(Boolean).map((x) => clean_(x, 80)).join(', ');
}

function notify_(r) {
  const to = Session.getEffectiveUser().getEmail();
  if (!to) return;
  const lines = [
    ['שם', r.name], ['טלפון', r.phone], ['איפה השיווק נתקע', r.stuck], ['מה רוצים לשפר', r.improve],
    ['תקציב מתוכנן', r.budget_planned], ['תקציב היום', r.budget_now], ['אינסטגרם', r.instagram],
    ['פייסבוק', r.facebook], ['אתר', r.website], ['נכסים נוספים', r.other_assets], ['מקור', r.utm_source],
  ].filter((l) => l[1]);
  MailApp.sendEmail({
    to: to,
    subject: 'ליד חדש מהשאלון: ' + r.name,
    htmlBody: '<div dir="rtl" style="font-family:Arial">' + lines.map((l) => '<p><b>' + l[0] + ':</b> ' + String(l[1]).replace(/</g, '&lt;') + '</p>').join('') +
      '<p><a href="https://wa.me/' + r.phone.replace(/^0/, '972') + '">וואטסאפ לליד</a></p></div>',
    name: 'BoostRize – לידים',
  });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** להרצה ידנית פעם אחת מהעורך: מאשר הרשאות וכותב שורת בדיקה */
function testSetup() {
  const res = doPost({ postData: { contents: JSON.stringify({ name: 'בדיקה', phone: '0500000000', stuck: ['לידים לא רלוונטיים'], improve: ['פרסום ממומן'], budget_planned: '5,000–10,000 ₪', budget_now: '3,000–5,000 ₪', lead_id: 'test-' + Date.now(), elapsed_ms: 5000 }) } });
  console.log(res.getContent());
}
