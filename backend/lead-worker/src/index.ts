/**
 * BoostRize Lead Receiver – Cloudflare Worker
 * ------------------------------------------------------------
 * מקבל לידים מהאתר הסטטי (GitHub Pages), מאמת, מסנן ספאם, מונע כפילויות
 * ומפיץ ליעדים שהוגדרו במשתני סביבה (Secrets). שום כתובת Webhook או מפתח API
 * לא נמצאים בקוד הציבורי של האתר.
 *
 * תשובה לדפדפן: { ok: true, lead_id } רק אחרי שהליד נשמר/נמסר בהצלחה
 * ליעד "ראשי" אחד לפחות. אחרת 5xx – והדפדפן מציג שגיאה ולא "הצלחה".
 *
 * Destinations (all optional; configure at least one):
 *  - LEADS_KV (KV binding)          → archive + dedupe + rate limit  (מומלץ מאוד)
 *  - WEBHOOK_URLS                   → Make / Zapier / any webhook (comma separated)
 *  - SHEETS_WEBHOOK_URL             → Google Apps Script web-app (Google Sheets)
 *  - MONDAY_API_TOKEN + MONDAY_BOARD_ID [+ MONDAY_COLUMN_MAP JSON]
 *  - HUBSPOT_TOKEN                  → HubSpot CRM contact upsert (private app token)
 *  - RESEND_API_KEY + NOTIFY_EMAIL_TO + NOTIFY_EMAIL_FROM → email alert
 *  - WHATSAPP_TOKEN + WHATSAPP_PHONE_ID + WHATSAPP_NOTIFY_TO [+ WHATSAPP_TEMPLATE] → WhatsApp Cloud API alert
 *  - TURNSTILE_SECRET               → Cloudflare Turnstile bot check
 *  - ALLOWED_ORIGINS                → comma separated (e.g. https://eliyaddigital-byte.github.io)
 * ראו INTEGRATIONS.md
 */

export interface Env {
  LEADS_KV?: KVNamespace;
  ALLOWED_ORIGINS?: string;
  WEBHOOK_URLS?: string;
  WEBHOOK_SECRET?: string;
  SHEETS_WEBHOOK_URL?: string;
  MONDAY_API_TOKEN?: string;
  MONDAY_BOARD_ID?: string;
  MONDAY_GROUP_ID?: string;
  MONDAY_COLUMN_MAP?: string;
  HUBSPOT_TOKEN?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_NOTIFY_TO?: string;
  WHATSAPP_TEMPLATE?: string;
  TURNSTILE_SECRET?: string;
  RATE_LIMIT_PER_HOUR?: string;
  DEDUPE_WINDOW_HOURS?: string;
}

type Lead = {
  lead_id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string;
  business: string;
  website: string;
  industry: string;
  budget: string;
  goal: string;
  marketing_consent: boolean;
  form_variant: string;
  experiments: Record<string, string>;
  source: string;
  landing_page: string;
  page_url: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbclid: string;
  ttclid: string;
  li_fat_id: string;
  msclkid: string;
  user_agent: string;
  country: string;
};

const MAX_BODY = 16 * 1024;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk && origin ? origin : allowed[0] || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });

    if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') return json(200, { ok: true });
    if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    if (!originOk) return json(403, { ok: false, error: 'origin_not_allowed' });
    if (!(req.headers.get('Content-Type') || '').includes('application/json')) return json(415, { ok: false, error: 'unsupported_media_type' });

    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'payload_too_large' });
    let body: Record<string, any>;
    try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'invalid_json' }); }

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';

    // ---- Rate limit (per IP, per hour) ----
    if (env.LEADS_KV) {
      const limit = Number(env.RATE_LIMIT_PER_HOUR || 5);
      const key = `rl:${await sha256(ip)}:${new Date().toISOString().slice(0, 13)}`;
      const count = Number((await env.LEADS_KV.get(key)) || 0);
      if (count >= limit) return json(429, { ok: false, error: 'rate_limited' });
      ctx.waitUntil(env.LEADS_KV.put(key, String(count + 1), { expirationTtl: 3700 }));
    }

    // ---- Bot checks: honeypot + minimum fill time + Turnstile ----
    const fakeOk = () => json(200, { ok: true, lead_id: crypto.randomUUID() }); // silently drop bots
    if (typeof body.hp === 'string' && body.hp.trim() !== '') return fakeOk();
    if (typeof body.elapsed_ms === 'number' && body.elapsed_ms < 2500) return fakeOk();
    if (env.TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET, String(body.turnstile_token || ''), ip);
      if (!ok) return json(403, { ok: false, error: 'bot_check_failed' });
    }

    // ---- Validate & sanitize ----
    const { lead, invalid } = sanitize(body, req);
    if (invalid.length) return json(422, { ok: false, error: 'validation_failed', fields: invalid });

    // ---- Dedupe: same lead_id (double submit) or same phone/email within window ----
    let fpKey = '';
    const dedupeHours = Number(env.DEDUPE_WINDOW_HOURS || 24);
    if (env.LEADS_KV) {
      const idKey = `id:${lead.lead_id}`;
      if (await env.LEADS_KV.get(idKey)) return json(200, { ok: true, lead_id: lead.lead_id, duplicate: true });
      fpKey = `fp:${await sha256(`${lead.phone}|${lead.email}`)}`;
      const prev = await env.LEADS_KV.get(fpKey);
      if (prev) {
        // Same person resubmitted recently: acknowledge, don't re-notify (avoids duplicate CRM items & conversions)
        return json(200, { ok: true, lead_id: prev, duplicate: true });
      }
    }

    // ---- Deliver ----
    const primary: Promise<string>[] = [];
    const secondary: Promise<string>[] = [];
    if (env.LEADS_KV) primary.push(env.LEADS_KV.put(`lead:${lead.created_at}:${lead.lead_id}`, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 180 }).then(() => 'kv'));
    if (env.LEADS_KV) primary.push(env.LEADS_KV.put(`id:${lead.lead_id}`, '1', { expirationTtl: 60 * 60 * 24 * 30 }).then(() => 'kv-id'));
    for (const u of (env.WEBHOOK_URLS || '').split(',').map((s) => s.trim()).filter(Boolean)) primary.push(postWebhook(u, lead, env.WEBHOOK_SECRET).then(() => 'webhook'));
    if (env.SHEETS_WEBHOOK_URL) primary.push(postWebhook(env.SHEETS_WEBHOOK_URL, lead, env.WEBHOOK_SECRET).then(() => 'sheets'));
    if (env.MONDAY_API_TOKEN && env.MONDAY_BOARD_ID) primary.push(toMonday(env, lead).then(() => 'monday'));
    if (env.HUBSPOT_TOKEN) primary.push(toHubSpot(env.HUBSPOT_TOKEN, lead).then(() => 'hubspot'));
    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO && env.NOTIFY_EMAIL_FROM) secondary.push(emailAlert(env, lead).then(() => 'email'));
    if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_NOTIFY_TO) secondary.push(whatsappAlert(env, lead).then(() => 'whatsapp'));

    if (primary.length === 0 && secondary.length === 0) {
      console.error('No lead destinations configured – refusing to acknowledge lead');
      return json(503, { ok: false, error: 'not_configured' });
    }

    const results = await Promise.allSettled([...primary, ...secondary]);
    const delivered = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<string>).value);
    const failures = results.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason));
    if (failures.length) console.error('Lead delivery failures', lead.lead_id, failures);

    const primaryOk = primary.length ? delivered.some((d) => ['kv', 'webhook', 'sheets', 'monday', 'hubspot'].includes(d)) : delivered.length > 0;
    if (!primaryOk) return json(502, { ok: false, error: 'delivery_failed' });
    // mark as seen only after successful delivery, so a failed attempt can be retried
    if (env.LEADS_KV && fpKey) ctx.waitUntil(env.LEADS_KV.put(fpKey, lead.lead_id, { expirationTtl: Math.max(60, dedupeHours * 3600) }));
    return json(200, { ok: true, lead_id: lead.lead_id });
  },
};

/* ================= helpers ================= */

const clean = (v: unknown, max = 200) =>
  String(v ?? '')
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function sanitize(b: Record<string, any>, req: Request): { lead: Lead; invalid: string[] } {
  const a = (b.attribution && typeof b.attribution === 'object' ? b.attribution : {}) as Record<string, unknown>;
  const invalid: string[] = [];
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 20).replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
  const email = clean(b.email, 120).toLowerCase();
  const website = clean(b.website, 200);
  if (name.length < 2) invalid.push('name');
  if (!/^0(5\d|[23489]|7\d)\d{7}$/.test(phone)) invalid.push('phone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) invalid.push('email');
  if (website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(website)) invalid.push('website');
  const leadId = /^[\w-]{8,64}$/.test(String(b.lead_id || '')) ? String(b.lead_id) : crypto.randomUUID();
  const utmSource = clean(a.utm_source);
  const lead: Lead = {
    lead_id: leadId,
    created_at: new Date().toISOString(),
    name,
    phone,
    email,
    business: clean(b.business, 100),
    website,
    industry: clean(b.industry, 60),
    budget: clean(b.budget, 60),
    goal: clean(b.goal, 80),
    marketing_consent: b.marketing_consent === true,
    form_variant: clean(b.form_variant, 40),
    experiments: Object.fromEntries(Object.entries((b.experiments as Record<string, unknown>) || {}).slice(0, 10).map(([k, v]) => [clean(k, 40), clean(v, 20)])),
    source: utmSource || (a.referrer ? 'referral' : 'direct'),
    landing_page: clean(a.landing_page, 500),
    page_url: clean(a.page_url, 500),
    referrer: clean(a.referrer, 300),
    utm_source: utmSource,
    utm_medium: clean(a.utm_medium),
    utm_campaign: clean(a.utm_campaign),
    utm_content: clean(a.utm_content),
    utm_term: clean(a.utm_term),
    gclid: clean(a.gclid, 300),
    gbraid: clean(a.gbraid, 300),
    wbraid: clean(a.wbraid, 300),
    fbclid: clean(a.fbclid, 300),
    ttclid: clean(a.ttclid, 300),
    li_fat_id: clean(a.li_fat_id, 300),
    msclkid: clean(a.msclkid, 300),
    user_agent: clean(req.headers.get('User-Agent'), 300),
    country: clean((req as any).cf?.country, 4),
  };
  return { lead, invalid };
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function fetchOk(url: string, init: RequestInit, label: string) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${label} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function postWebhook(url: string, lead: Lead, secret?: string) {
  const body = JSON.stringify(lead);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    headers['X-Signature-SHA256'] = [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  await fetchOk(url, { method: 'POST', headers, body }, 'webhook');
}

async function toMonday(env: Env, lead: Lead) {
  // MONDAY_COLUMN_MAP example: {"phone":"phone_mkx1","email":"email_mkx2","utm_source":"text_mkx3"}
  let map: Record<string, string> = {};
  try { map = JSON.parse(env.MONDAY_COLUMN_MAP || '{}'); } catch { /* ignore */ }
  const values: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(map)) {
    const v = (lead as any)[field];
    if (v === undefined || v === '') continue;
    if (col.startsWith('phone')) values[col] = { phone: v, countryShortName: 'IL' };
    else if (col.startsWith('email')) values[col] = { email: v, text: v };
    else values[col] = String(v);
  }
  const query = `mutation ($board: ID!, $group: String, $name: String!, $vals: JSON!) { create_item (board_id: $board, group_id: $group, item_name: $name, column_values: $vals, create_labels_if_missing: true) { id } }`;
  const r = await fetchOk('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.MONDAY_API_TOKEN!, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables: { board: env.MONDAY_BOARD_ID, group: env.MONDAY_GROUP_ID || null, name: `${lead.name}${lead.business ? ` – ${lead.business}` : ''}`, vals: JSON.stringify(values) } }),
  }, 'monday');
  const data = (await r.json()) as { errors?: unknown };
  if (data.errors) throw new Error(`monday: ${JSON.stringify(data.errors).slice(0, 200)}`);
}

async function toHubSpot(token: string, lead: Lead) {
  const [firstname, ...rest] = lead.name.split(' ');
  const properties: Record<string, string> = {
    email: lead.email, firstname, lastname: rest.join(' '), phone: lead.phone, company: lead.business, website: lead.website,
    hs_lead_status: 'NEW',
  };
  // custom properties (create them in HubSpot first, or remove): utm_source, utm_campaign, lead_id
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', { method: 'POST', headers, body: JSON.stringify({ properties }), signal: AbortSignal.timeout(8000) });
  if (r.status === 409) {
    // Contact exists → update by email
    await fetchOk(`https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email`, { method: 'PATCH', headers, body: JSON.stringify({ properties }) }, 'hubspot-update');
    return;
  }
  if (!r.ok) throw new Error(`hubspot ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function emailAlert(env: Env, lead: Lead) {
  const rows = Object.entries(lead).filter(([, v]) => v !== '' && v !== false && !(typeof v === 'object' && !Object.keys(v as object).length));
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ליד חדש מהאתר</h2><table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd"><b>${esc(k)}</b></td><td style="border:1px solid #ddd">${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td></tr>`).join('')}</table></div>`;
  await fetchOk('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.NOTIFY_EMAIL_FROM, to: env.NOTIFY_EMAIL_TO!.split(',').map((s) => s.trim()), subject: `ליד חדש: ${lead.name}${lead.business ? ` (${lead.business})` : ''}`, html, reply_to: lead.email }),
  }, 'email');
}

async function whatsappAlert(env: Env, lead: Lead) {
  // WhatsApp Cloud API: business-initiated messages require an approved template.
  // Default template name: "new_lead_alert" with 4 body params: name, phone, business, source.
  const template = env.WHATSAPP_TEMPLATE || 'new_lead_alert';
  await fetchOk(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: env.WHATSAPP_NOTIFY_TO,
      type: 'template',
      template: {
        name: template,
        language: { code: 'he' },
        components: [{ type: 'body', parameters: [lead.name, lead.phone, lead.business || '-', lead.utm_source || lead.source].map((text) => ({ type: 'text', text })) }],
      },
    }),
  }, 'whatsapp');
}

async function verifyTurnstile(secret: string, token: string, ip: string) {
  if (!token) return false;
  const fd = new FormData();
  fd.append('secret', secret);
  fd.append('response', token);
  fd.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd });
  const d = (await r.json()) as { success?: boolean };
  return Boolean(d.success);
}
