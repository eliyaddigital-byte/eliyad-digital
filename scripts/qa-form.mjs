/**
 * End-to-end form test (requires: dev-lead-server running on :8787 and a preview build
 * made with PUBLIC_LEAD_ENDPOINT=http://localhost:8787/ on :4321).
 *   node scripts/qa-form.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, rmSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4321/eliyad-digital/';
if (existsSync('qa-output/leads.jsonl')) rmSync('qa-output/leads.jsonl');
const out = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`${BASE}?utm_source=google&utm_medium=cpc&utm_campaign=qa_test&gclid=TESTGCLID`, { waitUntil: 'networkidle' });

await page.locator('#contact').scrollIntoViewIfNeeded();
// 1. validation errors on empty step 1
await page.click('[data-lf-next]');
out.step1Errors = await page.$$eval('.field-error', (els) => els.map((e) => e.textContent).filter(Boolean));
// 2. invalid phone
await page.fill('#lf-name', 'בדיקת QA');
await page.fill('#lf-phone', '123');
await page.fill('#lf-email', 'qa@example.com');
await page.click('[data-lf-next]');
out.phoneError = await page.textContent('#lf-phone-err');
// 3. valid → step 2
await page.fill('#lf-phone', '050-123-4567');
await page.click('[data-lf-next]');
out.step2Visible = await page.isVisible('[data-step="2"]');
await page.fill('#lf-business', 'עסק לדוגמה');
await page.selectOption('#lf-budget', { index: 3 });
await page.click('.chip >> nth=0');
await page.screenshot({ path: 'qa-output/mobile-form-step2.png' });
await page.waitForTimeout(2600); // pass the min-fill-time bot check
await Promise.all([page.waitForURL('**/thank-you/'), page.click('[data-lf-submit]')]);
out.redirectedTo = new URL(page.url()).pathname;
out.thankYouEvents = await page.evaluate(() => window.dataLayer.filter((e) => e && e.event === 'generate_lead').map((e) => ({ lead_id: e.lead_id, hasPII: JSON.stringify(e).includes('qa@example.com') })));
await page.screenshot({ path: 'qa-output/mobile-thank-you.png', fullPage: true });
// reload thank-you → must not fire again
await page.reload({ waitUntil: 'networkidle' });
out.generateLeadAfterReload = await page.evaluate(() => window.dataLayer.filter((e) => e && e.event === 'generate_lead').length);

const leads = existsSync('qa-output/leads.jsonl') ? readFileSync('qa-output/leads.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
out.leadsDelivered = leads.length;
out.leadSample = leads[0] && { name: leads[0].name, phone: leads[0].phone, utm_source: leads[0].utm_source, utm_campaign: leads[0].utm_campaign, gclid: leads[0].gclid, landing_page: leads[0].landing_page, lead_id: leads[0].lead_id, matchesEvent: leads[0].lead_id === out.thankYouEvents[0]?.lead_id };

// 4. server-side: duplicate submission & honeypot & bad origin & validation
const api = 'http://localhost:8787/';
const post = (body, origin = 'http://localhost:4321') => fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const good = { lead_id: 'dup-test-0001', name: 'כפול', phone: '0521112233', email: 'dup@example.com', elapsed_ms: 5000, attribution: {} };
out.serverFirst = await post(good);
out.serverDuplicateSameId = await post(good);
out.serverDuplicateSamePerson = await post({ ...good, lead_id: 'dup-test-0002' });
out.serverHoneypot = await post({ ...good, lead_id: 'hp-0001', email: 'bot@example.com', hp: 'http://spam' });
out.serverBadOrigin = await post({ ...good, lead_id: 'origin-0001', email: 'o@example.com' }, 'https://evil.example');
out.serverValidation = await post({ lead_id: 'val-0001', name: 'x', phone: '1', email: 'nope', elapsed_ms: 5000 });
out.serverXss = await post({ lead_id: 'xss-00001', name: '<script>alert(1)</script>', phone: '0531234567', email: 'x@example.com', elapsed_ms: 5000 });
const after = readFileSync('qa-output/leads.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
out.totalDeliveredAfterServerTests = after.length; // expect: 1 (form) + 1 (first) + 1 (xss sanitized) = 3
out.xssStoredName = after.find((l) => l.lead_id === 'xss-00001')?.name;

console.log(JSON.stringify(out, null, 2));
await browser.close();
