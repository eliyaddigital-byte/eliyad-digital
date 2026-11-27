/**
 * Generates og-image.png (1200x630), favicon PNGs and the standalone logo SVGs into public/.
 *   node scripts/make-brand-assets.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fontPath = require.resolve('@fontsource-variable/rubik/files/rubik-hebrew-wght-normal.woff2');
const fontLatin = require.resolve('@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2');
const fontText = fontPath;
const f64 = (p) => readFileSync(p).toString('base64');
const MARK = `<path fill="#f37a1f" fill-rule="evenodd" d="M10 4H55a28 28 0 0 1 8 54.8L90 116H63L38.5 62H34v-4H10Z M34 24V40H54a8 8 0 0 0 0-16Z"/><path fill="#f37a1f" d="M34 62 22 116H0l9-41-7 3L6 52l28 6-8 6Z"/><circle cx="90" cy="12" r="10" fill="#f37a1f"/>`;
const css = `@font-face{font-family:D;src:url(data:font/woff2;base64,${f64(fontPath)}) format('woff2');font-weight:300 900}
@font-face{font-family:R;src:url(data:font/woff2;base64,${f64(fontLatin)}) format('woff2');font-weight:300 900}
@font-face{font-family:T;src:url(data:font/woff2;base64,${f64(fontText)}) format('woff2')}
*{margin:0;box-sizing:border-box}html{overflow:hidden}body{font-family:R}`;
const logo = (color, size) => `<span style="display:inline-flex;align-items:flex-end;font-weight:800;letter-spacing:-.035em;line-height:1;color:${color};font-size:${size}px;direction:ltr">Boost<svg viewBox="0 0 100 120" style="height:.98em;width:auto;margin:0 .03em .06em .02em;overflow:visible">${MARK}</svg>ize</span>`;

const og = `<html dir="rtl"><style>${css}
body{width:1200px;height:630px;background:#f0741a;position:relative;overflow:hidden;padding:64px 80px}
h1{font-family:D;font-weight:900;font-size:120px;line-height:1.05;letter-spacing:-2px;color:#000;margin-top:40px}
p{font-family:T;font-size:34px;color:#000;margin-top:34px;max-width:900px}
.logo{position:absolute;left:80px;top:56px;background:#fff;padding:14px 22px;border-radius:999px}</style>
<body><div class="logo"><img src="data:image/png;base64,${readFileSync('public/brand/boostrize-logo.png').toString('base64')}" style="height:46px;display:block"></div><h1>לא עוד לידים.<br>יותר לקוחות.</h1><p>קמפיינים ממומנים שנמדדים עד העסקה. לא עד הקליק.</p></body></html>`;

const icon = (size, radius) => `<html><style>${css}body{width:${size}px;height:${size}px;background:transparent}</style><body><div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:#0f0f0f;display:grid;place-items:center"><svg viewBox="0 0 100 120" style="height:${Math.round(size * 0.62)}px;overflow:visible">${MARK}</svg></div></body></html>`;

const b = await chromium.launch();
const shot = async (html, w, h, path, omitBackground = false) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path, omitBackground });
  await p.close();
};
await shot(og, 1200, 630, 'public/og-image.png');
await b.close();

// Standalone vector logos (text rendered with system bold sans as fallback – replace with the original vector logo when available)
mkdirSync('public/brand', { recursive: true });
const svgLogo = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 130"><text x="0" y="112" font-family="Rubik, Arial, sans-serif" font-weight="800" font-size="128" letter-spacing="-4" fill="${fill}">Boost</text><g transform="translate(318 8) scale(0.9)">${MARK}</g><text x="408" y="112" font-family="Rubik, Arial, sans-serif" font-weight="800" font-size="128" letter-spacing="-4" fill="${fill}">ize</text></svg>`;
console.log('brand assets generated');
