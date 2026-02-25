/**
 * Vercel Serverless Function: /api/proxy/sync
 * Forwards sync requests to LifeOS VPS backend.
 *
 * Environment variables required (set in Vercel dashboard):
 * - LIFEOS_SYNC_URL: VPS API base URL (e.g., http://VPS_IP:8001/api/sync)
 * - LIFEOS_SYNC_TOKEN: Device auth token (UUID)
 */

// Rate limiting: 5 syncs per minute per IP
const ipCalls = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipCalls.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipCalls.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  // Origin check
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (origin && !origin.includes(host) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Validate config
  const SYNC_URL = process.env.LIFEOS_SYNC_URL;
  const SYNC_TOKEN = process.env.LIFEOS_SYNC_TOKEN;
  if (!SYNC_URL || !SYNC_TOKEN) {
    return res.status(500).json({ error: 'Sync not configured' });
  }

  // Route: ?endpoint=push | status
  const endpoint = req.query.endpoint || 'push';
  if (!['push', 'status', 'delta', 'pull'].includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  // Build VPS URL, forward query params (except 'endpoint')
  const queryParams = { ...req.query };
  delete queryParams.endpoint;
  const qs = new URLSearchParams(queryParams).toString();
  const vpsUrl = `${SYNC_URL}/${endpoint}/${qs ? '?' + qs : ''}`;
  const isPush = endpoint === 'push' || endpoint === 'delta';

  if (isPush && req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  try {
    const vpsRes = await fetch(vpsUrl, {
      method: isPush ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SYNC_TOKEN}`,
      },
      body: isPush ? JSON.stringify(req.body) : undefined,
    });

    const data = await vpsRes.json().catch(() => ({ error: `Server returned ${vpsRes.status}` }));
    return res.status(vpsRes.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach sync server', detail: e.message });
  }
}
