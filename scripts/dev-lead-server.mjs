/**
 * Local test harness for the lead Worker (backend/lead-worker/src/index.ts).
 * Runs the real Worker fetch handler inside Node (Node >= 23 strips TS types natively),
 * with an in-memory KV and a local webhook "catcher" that appends to qa-output/leads.jsonl.
 *
 *   node scripts/dev-lead-server.mjs            → http://localhost:8787
 *   PUBLIC_LEAD_ENDPOINT=http://localhost:8787/ npm run build && npm run preview
 *
 * For development / QA only – production runs on Cloudflare Workers (see INTEGRATIONS.md).
 */
import http from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import worker from '../backend/lead-worker/src/index.ts';

const PORT = Number(process.env.PORT || 8787);
mkdirSync('qa-output', { recursive: true });

const store = new Map();
const kv = {
  async get(k) { const v = store.get(k); if (!v) return null; if (v.exp && v.exp < Date.now()) { store.delete(k); return null; } return v.value; },
  async put(k, value, opts = {}) { store.set(k, { value, exp: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0 }); },
};

const env = {
  LEADS_KV: kv,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:4321',
  WEBHOOK_URLS: `http://localhost:${PORT}/__catch`,
  RATE_LIMIT_PER_HOUR: process.env.RATE_LIMIT_PER_HOUR || '20',
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (req.url === '/__catch') {
    appendFileSync('qa-output/leads.jsonl', body.toString() + '\n');
    res.writeHead(200).end('ok');
    return;
  }
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: { ...req.headers, 'cf-connecting-ip': req.socket.remoteAddress || '127.0.0.1' },
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body,
  });
  const waits = [];
  const response = await worker.fetch(request, env, { waitUntil: (p) => waits.push(p), passThroughOnException() {} });
  await Promise.allSettled(waits);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`lead worker harness on http://localhost:${PORT}`));
