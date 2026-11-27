/**
 * BoostRize – Google Apps Script לקבלת לידים מה-Cloudflare Worker
 * ------------------------------------------------------------------
 * 1. כותב כל ליד כשורה חדשה בגיליון "Leads"
 * 2. שולח התראת מייל לבעל הגיליון (או לכתובת ב-NOTIFY_EMAIL)
 *
 * הגנה: הסקריפט מקבל רק בקשות עם ?key=<SECRET_KEY> הנכון.
 * את הכתובת המלאכה (כולל ה-key) שומרים רק כ-Secret ב-Worker – לא באתר.
 *
 * התקנה: ראו INTEGRATIONS.md → Google Sheets
 */

// ====== הגדרות – לשנות לפני ה-Deploy ======
const SECRET_KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';
const NOTIFY_EMAIL = ''; // ריק = נשלח לבעל החשבון (Session.getEffectiveUser)
const SHEET_NAME = 'Leads';
// ==========================================

const COLUMNS = [
  ['created_at', 'תאריך ושעה'],
  ['name', 'שם'],
  ['phone', 'טלפון'],
  ['email', 'אימייל'],
  ['business', 'עסק'],
  ['website', 'אתר'],
  ['industry', 'תחום'],
  ['budget', 'תקציב'],
  ['goal', 'מטרה'],
  ['marketing_consent', 'הסכמה לדיוור'],
  ['source', 'מקור'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_content', 'utm_content'],
  ['utm_term', 'utm_term'],
  ['gclid', 'gclid'],
  ['fbclid', 'fbclid'],
  ['ttclid', 'ttclid'],
  ['landing_page', 'עמוד נחיתה'],
  ['referrer', 'הפניה'],
  ['form_variant', 'וריאנט טופס'],
  ['lead_id', 'מזהה ליד'],
  ['status', 'סטטוס'],
];

function doPost(e) {
  try {
    if (!e || !e.parameter || e.parameter.key !== SECRET_KEY) return out_({ ok: false, error: 'unauthorized' });
    const lead = JSON.parse(e.postData.contents);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = getSheet_();
      // הגנת כפילות: אותו lead_id כבר קיים?
      const idCol = COLUMNS.findIndex((c) => c[0] === 'lead_id') + 1;
      const last = sh.getLastRow();
      if (last > 1) {
        const ids = sh.getRange(2, idCol, last - 1, 1).getValues().flat();
        if (ids.indexOf(lead.lead_id) !== -1) return out_({ ok: true, duplicate: true });
      }
      const row = COLUMNS.map(([key]) => {
        if (key === 'status') return 'חדש';
        if (key === 'created_at') return lead.created_at ? new Date(lead.created_at) : new Date();
        if (key === 'marketing_consent') return lead.marketing_consent ? 'כן' : 'לא';
        const v = lead[key];
        // מניעת הזרקת נוסחאות לגיליון
        return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v == null ? '' : v;
      });
      sh.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    notify_(lead);
    return out_({ ok: true });
  } catch (err) {
    console.error(err);
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, service: 'boostrize-leads' });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLUMNS.map((c) => c[1]));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold').setBackground('#f37a1f');
    sh.setRightToLeft(true);
  }
  return sh;
}

function notify_(lead) {
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rows = [
    ['שם', lead.name], ['טלפון', lead.phone], ['אימייל', lead.email], ['עסק', lead.business], ['אתר', lead.website],
    ['תחום', lead.industry], ['תקציב', lead.budget], ['מטרה', lead.goal],
    ['מקור', [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(String).join(' / ') || lead.source],
    ['עמוד נחיתה', lead.landing_page],
  ].filter((r) => r[1]);
  const phoneIntl = String(lead.phone || '').replace(/^0/, '972');
  const html =
    '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">' +
    '<h2 style="margin:0 0 12px">ליד חדש מהאתר 🎯</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map((r) => '<tr><td style="border:1px solid #ddd;background:#f7f4ee"><b>' + esc(r[0]) + '</b></td><td style="border:1px solid #ddd">' + esc(r[1]) + '</td></tr>').join('') +
    '</table>' +
    (phoneIntl ? '<p><a href="https://wa.me/' + esc(phoneIntl) + '">לשליחת וואטסאפ לליד</a> · <a href="tel:' + esc(lead.phone) + '">חיוג</a></p>' : '') +
    '<p style="color:#777;font-size:12px">' + esc(SpreadsheetApp.getActiveSpreadsheet().getUrl()) + '</p></div>';
  MailApp.sendEmail({
    to: to,
    subject: 'ליד חדש: ' + (lead.name || '') + (lead.business ? ' (' + lead.business + ')' : ''),
    htmlBody: html,
    replyTo: lead.email || undefined,
    name: 'BoostRize – לידים',
  });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** להרצה ידנית מהעורך פעם אחת – מאשר הרשאות ושולח ליד בדיקה */
function testSetup() {
  const fake = { parameter: { key: SECRET_KEY }, postData: { contents: JSON.stringify({ lead_id: 'test-' + Date.now(), created_at: new Date().toISOString(), name: 'ליד בדיקה', phone: '0500000000', email: 'test@example.com', source: 'test' }) } };
  console.log(doPost(fake).getContent());
}
