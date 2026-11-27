/**
 * QA script – Playwright smoke tests + screenshots + axe accessibility scan.
 * Usage:  npm run build && npm run preview  (in another terminal)
 *         node scripts/qa.mjs [baseUrl]
 * Default baseUrl: http://localhost:4321/eliyad-digital/
 * Output: qa-output/ (screenshots + report.json)
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = (process.argv[2] || 'http://localhost:4321/eliyad-digital/').replace(/\/?$/, '/');
const OUT = 'qa-output';
mkdirSync(OUT, { recursive: true });

const pages = ['', 'privacy/', 'terms/', 'accessibility/', 'thank-you/', 'does-not-exist/'];
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

let axeSource = '';
try { axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { /* axe optional */ }

const report = { base: BASE, date: new Date().toISOString(), results: [] };
const browser = await chromium.launch();

async function autoScroll(page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.7;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(800);
}

for (const [vpName, vp] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, locale: 'he-IL' });
  for (const p of pages) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    page.on('requestfailed', (r) => failed.push(r.url()));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('does-not-exist')) failed.push(`${r.status()} ${r.url()}`); });
    const url = BASE + p;
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    await autoScroll(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const meta = await page.evaluate(() => ({
      title: document.title,
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      h1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
      description: document.querySelector('meta[name=description]')?.getAttribute('content') || '',
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') || '',
      imagesWithoutAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      ldjson: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return 'ok'; } catch { return 'invalid'; } }),
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
    }));
    let axe = null;
    if (axeSource && vpName !== 'tablet') {
      await page.addScriptTag({ content: axeSource });
      axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
    }
    const name = `${vpName}-${p.replace(/\/$/, '') || 'home'}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    if (p === '') await page.screenshot({ path: `${OUT}/${vpName}-home-fold.png` });
    report.results.push({ viewport: vpName, page: p || '/', status: res?.status(), overflow, consoleErrors, failed, axe, meta: { ...meta, links: undefined } });

    // Internal link check (home only, once)
    if (p === '' && vpName === 'desktop') {
      const internal = [...new Set(meta.links.filter((l) => l.startsWith(BASE.replace(/\/eliyad-digital\/$/, ''))).map((l) => l.split('#')[0]))];
      const broken = [];
      for (const l of internal) {
        const r = await ctx.request.get(l);
        if (r.status() >= 400) broken.push(`${r.status()} ${l}`);
      }
      // Anchor targets exist
      const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
      report.linkCheck = { checked: internal.length, broken, missingAnchors: [...new Set(anchors)] };
    }
    await page.close();
  }
  await ctx.close();
}

// Mobile interactions: menu + services tabs + FAQ
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const checks = {};
  await page.click('[data-menu-toggle]');
  checks.menuOpens = await page.isVisible('#mobile-menu');
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png` });
  await page.keyboard.press('Escape');
  checks.menuClosesOnEsc = !(await page.isVisible('#mobile-menu'));
  await page.click('.svc-list summary >> nth=0');
  checks.serviceOpens = await page.evaluate(() => document.querySelector('.svc-list details')?.hasAttribute('open'));
  await page.locator('#calc-close').fill('20');
  checks.calculator = await page.evaluate(() => ({ cpa: document.querySelector('[data-res="cpa"]')?.textContent, waHasNumbers: document.querySelector('[data-calc-wa]')?.getAttribute('href')?.includes('20%25') }));
  await page.click('.qa summary');
  checks.faqOpens = await page.evaluate(() => document.querySelector('.qa')?.hasAttribute('open'));
  await page.evaluate(() => scrollTo({ top: 1600, behavior: 'instant' }));
  await page.waitForTimeout(500);
  checks.stickyCtaVisible = await page.evaluate(() => document.querySelector('[data-mobile-cta]')?.classList.contains('is-visible'));
  const dl = await page.evaluate(() => window.dataLayer.filter((e) => e && e.event).map((e) => e.event));
  checks.dataLayerEvents = [...new Set(dl)];
  report.interactions = checks;
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

// Summary
const summary = report.results.map((r) => `${r.viewport.padEnd(8)} ${r.page.padEnd(18)} status=${r.status} overflow=${r.overflow} consoleErr=${r.consoleErrors.length} failed=${r.failed.length} axe=${r.axe ? r.axe.map((v) => `${v.id}(${v.impact}x${v.nodes})`).join(',') || 'clean' : '-'}`);
console.log(summary.join('\n'));
console.log('linkCheck', JSON.stringify(report.linkCheck));
console.log('interactions', JSON.stringify(report.interactions));
const errs = report.results.flatMap((r) => r.consoleErrors.map((e) => `${r.viewport} ${r.page}: ${e}`));
if (errs.length) console.log('CONSOLE ERRORS:\n' + [...new Set(errs)].join('\n'));
const fails = report.results.flatMap((r) => r.failed);
if (fails.length) console.log('FAILED REQUESTS:\n' + [...new Set(fails)].join('\n'));
if (!existsSync(OUT)) process.exit(1);
