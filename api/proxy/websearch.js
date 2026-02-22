/**
 * Vercel Serverless Function: /api/proxy/websearch
 * Proxies search queries to DuckDuckGo Instant Answer API.
 * Free, no API key required.
 */

const ipCalls = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.length > 200) {
    return res.status(400).json({ error: 'Invalid query parameter' });
  }

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(502).json({ error: `DuckDuckGo returned ${upstream.status}` });
    }

    const data = await upstream.json();
    const topics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];

    return res.status(200).json({
      answer: data.Answer || null,
      abstract: data.Abstract || null,
      abstract_source: data.AbstractSource || null,
      abstract_url: data.AbstractURL || null,
      related_topics: topics.slice(0, 5).map(t => ({
        text: t?.Text || null,
        url: t?.FirstURL || null,
      })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Search failed', detail: e.message });
  }
}
