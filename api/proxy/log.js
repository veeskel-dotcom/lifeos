/**
 * Vercel Serverless Function: /api/proxy/log
 * Receives client-side error reports and logs them to Vercel Runtime Logs.
 * POST { errors: [{ level, cat, msg, data, screen, ts, ua }] }
 */

// Rate limit: max 20 log batches per minute per IP
const ipCalls = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipCalls.get(ip);
  if (!entry || now - entry.start > 60_000) {
    ipCalls.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { errors } = req.body || {};
  if (!Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({ error: 'errors array required' });
  }

  // Log each error to Vercel Runtime Logs (max 10 per batch)
  const batch = errors.slice(0, 10);
  for (const entry of batch) {
    const tag = `[LifeOS ${entry.level || 'error'}]`;
    const screen = entry.screen || '?';
    const msg = String(entry.msg || '').slice(0, 500);
    const data = entry.data ? String(entry.data).slice(0, 1000) : '';
    const ua = entry.ua ? ` | UA: ${String(entry.ua).slice(0, 100)}` : '';
    const ts = entry.ts ? new Date(entry.ts).toISOString() : '';

    if (entry.level === 'error') {
      console.error(`${tag} [${screen}] ${msg}${data ? '\n' + data : ''}${ua} | ${ts}`);
    } else {
      console.warn(`${tag} [${screen}] ${msg}${data ? '\n' + data : ''}${ua} | ${ts}`);
    }
  }

  return res.status(200).json({ ok: true, received: batch.length });
}
