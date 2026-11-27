/**
 * Tracking layer – dataLayer events, Consent Mode v2, attribution, A/B variants.
 * מסמך: TRACKING_PLAN.md
 *
 * עקרונות:
 *  - שום תג צד-שלישי לא נטען לפני הסכמה (GTM/GA4/Clarity נטענים רק אחרי בחירת המשתמש).
 *  - Consent Mode v2 מוגדר ל-denied כברירת מחדל (בסקריפט inline ב-<head>).
 *  - אין שליחת PII ל-dataLayer / GA4 (לא שם, טלפון או מייל).
 *  - generate_lead נשלח רק אחרי אישור השרת, עם lead_id ייחודי למניעת כפילות.
 */

type Dict = Record<string, unknown>;
type ConsentState = { analytics: boolean; marketing: boolean; ts: number; v: number };

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __brTrack?: (event: string, params?: Dict) => void;
  }
}

const CFG_EL = document.getElementById('site-config');
const CFG = (CFG_EL ? JSON.parse(CFG_EL.textContent || '{}') : {}) as {
  gtmId?: string; ga4Id?: string; clarityId?: string; experiments?: Record<string, string[]>;
};

const CONSENT_KEY = 'br_consent';
const CONSENT_VERSION = 1;
const ATTR_KEY = 'br_attr';

window.dataLayer = window.dataLayer || [];

const safeStorage = {
  get(store: Storage | undefined, k: string) { try { return store?.getItem(k) ?? null; } catch { return null; } },
  set(store: Storage | undefined, k: string, v: string) { try { store?.setItem(k, v); } catch { /* storage blocked */ } },
};
const ls = (() => { try { return window.localStorage; } catch { return undefined; } })();
const ss = (() => { try { return window.sessionStorage; } catch { return undefined; } })();

/* ---------------- Events ---------------- */
export function track(event: string, params: Dict = {}) {
  window.dataLayer.push({ event, ...params });
}
window.__brTrack = track;

/* ---------------- Consent ---------------- */
export function getConsent(): ConsentState | null {
  const raw = safeStorage.get(ls, CONSENT_KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as ConsentState;
    return c.v === CONSENT_VERSION ? c : null;
  } catch { return null; }
}

function gtagConsentUpdate(c: { analytics: boolean; marketing: boolean }) {
  window.gtag?.('consent', 'update', {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
  });
}

export function setConsent(analytics: boolean, marketing: boolean) {
  const c: ConsentState = { analytics, marketing, ts: Date.now(), v: CONSENT_VERSION };
  safeStorage.set(ls, CONSENT_KEY, JSON.stringify(c));
  gtagConsentUpdate(c);
  track('consent_update', { consent_analytics: analytics, consent_marketing: marketing });
  applyConsent(c);
}

let tagsLoaded = false;
function loadScript(src: string) {
  const s = document.createElement('script');
  s.async = true; s.src = src;
  document.head.appendChild(s);
}
function applyConsent(c: ConsentState) {
  if (c.marketing) persistClickIds();
  if (tagsLoaded || (!c.analytics && !c.marketing)) return;
  tagsLoaded = true;
  if (CFG.gtmId) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(CFG.gtmId)}`);
  } else if (CFG.ga4Id && c.analytics) {
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CFG.ga4Id)}`);
    window.gtag?.('js', new Date());
    window.gtag?.('config', CFG.ga4Id, { anonymize_ip: true });
  }
  if (CFG.clarityId && c.analytics) {
    const id = CFG.clarityId;
    (function (w: any, d: Document, t: string) {
      w.clarity = w.clarity || function (...a: unknown[]) { (w.clarity.q = w.clarity.q || []).push(a); };
      const el = d.createElement(t) as HTMLScriptElement; el.async = true;
      el.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
      d.head.appendChild(el);
    })(window, document, 'script');
  }
}

/* ---------------- Attribution (UTM + click IDs) ---------------- */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'li_fat_id', 'msclkid'] as const;
const params = new URLSearchParams(location.search);
const pendingClickIds: Dict = {};
CLICK_KEYS.forEach((k) => { const v = params.get(k); if (v) pendingClickIds[k] = v.slice(0, 300); });

function readAttr(): Dict {
  try { return JSON.parse(safeStorage.get(ss, ATTR_KEY) || '{}'); } catch { return {}; }
}
function writeAttr(a: Dict) { safeStorage.set(ss, ATTR_KEY, JSON.stringify(a)); }

(function captureUtm() {
  const a = readAttr();
  const utm: Dict = {};
  UTM_KEYS.forEach((k) => { const v = params.get(k); if (v) utm[k] = v.slice(0, 200); });
  if (Object.keys(utm).length) {
    a.last = { ...utm, landing_page: location.pathname, ts: Date.now() };
    if (!a.first) a.first = a.last;
  }
  if (!a.landing_page) a.landing_page = location.href.split('#')[0].slice(0, 500);
  if (!a.referrer && document.referrer && !document.referrer.startsWith(location.origin)) a.referrer = document.referrer.slice(0, 300);
  writeAttr(a);
})();

function persistClickIds() {
  if (!Object.keys(pendingClickIds).length) return;
  const a = readAttr();
  a.click = { ...(a.click as Dict | undefined), ...pendingClickIds };
  writeAttr(a);
}

/** נתוני ייחוס שנשלחים עם הליד. Click IDs נכללים רק אם ניתנה הסכמה שיווקית */
export function getAttribution(): Dict {
  const a = readAttr();
  const c = getConsent();
  const last = (a.last as Dict | undefined) || {};
  // Without marketing consent, strip ad click IDs from URLs as well
  const scrub = (u: string) => {
    if (c?.marketing) return u;
    try {
      const x = new URL(u);
      CLICK_KEYS.forEach((k) => x.searchParams.delete(k));
      return x.toString();
    } catch { return u; }
  };
  const out: Dict = {
    landing_page: scrub(String(a.landing_page || location.href)),
    referrer: a.referrer || '',
    page_url: scrub(location.href.split('#')[0]),
  };
  UTM_KEYS.forEach((k) => { out[k] = (last[k] as string) || ''; });
  out.first_touch = a.first || null;
  if (c?.marketing) Object.assign(out, a.click || {}, pendingClickIds);
  return out;
}

/* ---------------- A/B experiments ---------------- */
export function getVariant(key: string): string {
  const variants = CFG.experiments?.[key];
  if (!variants?.length) return '';
  const forced = params.get(`ab_${key}`);
  if (forced && variants.includes(forced)) return forced;
  const storeKey = `br_ab_${key}`;
  let v = safeStorage.get(ls, storeKey);
  if (!v || !variants.includes(v)) {
    v = variants[Math.floor(Math.random() * variants.length)];
    safeStorage.set(ls, storeKey, v);
  }
  return v;
}

function applyExperiments() {
  const seen: Dict = {};
  document.querySelectorAll<HTMLElement>('[data-experiment]').forEach((el) => {
    const key = el.dataset.experiment!;
    const v = getVariant(key);
    if (!v) return;
    seen[key] = v;
    el.querySelectorAll<HTMLElement>('[data-variant]').forEach((node) => {
      node.hidden = node.dataset.variant !== v;
    });
  });
  if (Object.keys(seen).length) {
    Object.entries(seen).forEach(([k, v]) => track('experiment_impression', { experiment_id: k, variant_id: v }));
  }
}

/* ---------------- Auto events ---------------- */
function bindClicks() {
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('a, button');
    if (!t) return;
    const href = t.getAttribute('href') || '';
    const location_ = t.dataset.ctaLocation || t.closest<HTMLElement>('[data-section]')?.dataset.section || '';
    if (href.startsWith('https://wa.me') || href.includes('api.whatsapp.com')) track('whatsapp_click', { click_location: location_ });
    else if (href.startsWith('tel:')) track('phone_click', { click_location: location_ });
    else if (href.startsWith('mailto:')) track('email_click', { click_location: location_ });
    if (t.dataset.cta) track('cta_click', { cta_id: t.dataset.cta, cta_text: (t.textContent || '').trim().slice(0, 60), click_location: location_ });
  }, { capture: true });
}

function bindScrollDepth() {
  const marks = [25, 50, 75, 90];
  const fired = new Set<number>();
  let ticking = false;
  const check = () => {
    ticking = false;
    const h = document.documentElement;
    const pct = ((h.scrollTop + innerHeight) / h.scrollHeight) * 100;
    marks.forEach((m) => { if (pct >= m && !fired.has(m)) { fired.add(m); track('scroll_depth', { percent_scrolled: m }); } });
    if (fired.size === marks.length) removeEventListener('scroll', onScroll);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  addEventListener('scroll', onScroll, { passive: true });
}

/* ---------------- Init ---------------- */
applyExperiments();
const existing = getConsent();
if (existing) { gtagConsentUpdate(existing); applyConsent(existing); }
track('page_view', { page_path: location.pathname, page_title: document.title });
bindClicks();
bindScrollDepth();
