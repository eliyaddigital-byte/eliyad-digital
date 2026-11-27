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
const f64 = (p) => readFileSync(p).toString('base64');
const MARK = `<path fill="#f37a1f" fill-rule="evenodd" d="M10 4H55a28 28 0 0 1 8 54.8L90 116H63L38.5 62H34v-4H10Z M34 24V40H54a8 8 0 0 0 0-16Z"/><path fill="#f37a1f" d="M34 62 22 116H0l9-41-7 3L6 52l28 6-8 6Z"/><circle cx="90" cy="12" r="10" fill="#f37a1f"/>`;
const css = `@font-face{font-family:R;src:url(data:font/woff2;base64,${f64(fontPath)}) format('woff2');unicode-range:U+0590-05FF}
@font-face{font-family:R;src:url(data:font/woff2;base64,${f64(fontLatin)}) format('woff2')}
*{margin:0;box-sizing:border-box}html{overflow:hidden}body{font-family:R}`;
const logo = (color, size) => `<span style="display:inline-flex;align-items:flex-end;font-weight:800;letter-spacing:-.035em;line-height:1;color:${color};font-size:${size}px;direction:ltr">Boost<svg viewBox="0 0 100 120" style="height:.98em;width:auto;margin:0 .03em .06em .02em;overflow:visible">${MARK}</svg>ize</span>`;

const og = `<html dir="rtl"><style>${css}
body{width:1200px;height:630px;background:#f7f4ee;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(#dcd5c8 1px,transparent 1px),linear-gradient(90deg,#dcd5c8 1px,transparent 1px);background-size:56px 56px;opacity:.5}
.dot{position:absolute;width:520px;height:520px;border-radius:50%;background:#f37a1f;left:0;bottom:-200px;transform:translateX(-140px)}
.card{position:absolute;left:70px;top:150px;width:360px;background:#fff;border:3px solid #0f0f0f;border-radius:10px;box-shadow:8px 8px 0 #0f0f0f;padding:22px}
.card b{font-size:22px}.bar{height:26px;border-radius:4px;background:#efeae0;margin:10px auto 0}
.wrap{position:absolute;right:80px;top:70px;width:640px}
h1{font-size:76px;line-height:1.02;font-weight:900;letter-spacing:-.03em;color:#0f0f0f;margin-top:46px}
.m{position:relative;z-index:0}.m:after{content:'';position:absolute;z-index:-1;left:-4px;right:-4px;bottom:6px;height:30px;background:#f37a1f}
p{font-size:28px;color:#2a2a2a;margin-top:26px}</style>
<body><div class="grid"></div><div class="dot"></div>
<div class="card"><b>מהמודעה ועד העסקה</b>
<svg viewBox="0 0 320 120" style="width:100%;height:120px;margin-top:8px"><path d="M0 108 C60 100 110 92 160 74 S250 34 316 12" fill="none" stroke="#0f0f0f" stroke-width="5" stroke-linecap="round"/><circle cx="312" cy="13" r="9" fill="#f37a1f" stroke="#0f0f0f" stroke-width="4"/></svg>
<div class="bar" style="width:100%"></div><div class="bar" style="width:72%"></div><div class="bar" style="width:48%;background:#0f0f0f"></div></div>
<div class="wrap">${logo('#0f0f0f', 54)}<h1>לא עוד לידים.<br><span class="m">יותר לקוחות.</span></h1><p>פרסום ממומן, מדידה ואוטומציה שמחוברים לשורה התחתונה.</p></div></body></html>`;

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
await shot(icon(32, 7), 32, 32, 'public/favicon-32.png', true);
await shot(icon(180, 0), 180, 180, 'public/apple-touch-icon.png');
await shot(icon(192, 40), 192, 192, 'public/favicon-192.png', true);
await shot(icon(512, 100), 512, 512, 'public/favicon-512.png', true);
await b.close();

// Standalone vector logos (text rendered with system bold sans as fallback – replace with the original vector logo when available)
mkdirSync('public/brand', { recursive: true });
const svgLogo = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 130"><text x="0" y="112" font-family="Rubik, Arial, sans-serif" font-weight="800" font-size="128" letter-spacing="-4" fill="${fill}">Boost</text><g transform="translate(318 8) scale(0.9)">${MARK}</g><text x="408" y="112" font-family="Rubik, Arial, sans-serif" font-weight="800" font-size="128" letter-spacing="-4" fill="${fill}">ize</text></svg>`;
writeFileSync('public/brand/logo.svg', svgLogo('#0f0f0f'));
writeFileSync('public/brand/logo-light.svg', svgLogo('#ffffff'));
console.log('brand assets generated');
