/**
 * Vercel Serverless Function: /api/proxy/openrouter
 * Proxies requests to OpenRouter API, keeping the API key server-side.
 *
 * Environment variable required: OPENROUTER_API_KEY (set in Vercel dashboard, no VITE_ prefix)
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Simple in-memory rate limiting per IP (resets on cold start)
const ipCalls = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30; // max 30 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipCalls.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipCalls.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Origin check — allow same-origin and common Vercel preview URLs
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (origin && !origin.includes(host) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden: origin mismatch' });
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  // Validate API key is configured
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: API key not set' });
  }

  // Validate request body
  const { model, messages, max_tokens, temperature, stream } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  // Streaming requests
  if (stream) {
    try {
      const upstreamRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin || `https://${host}`,
          'X-Title': 'LifeOS',
        },
        body: JSON.stringify({ model, messages, max_tokens, temperature, stream: true }),
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        return res.status(upstreamRes.status).json({
          error: `OpenRouter error: ${upstreamRes.status}`,
          detail: errText,
        });
      }

      // Forward SSE stream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamErr) {
        // Client may have disconnected
      } finally {
        res.end();
      }
    } catch (e) {
      return res.status(502).json({ error: 'Failed to reach OpenRouter', detail: e.message });
    }
    return;
  }

  // Non-streaming requests
  try {
    const upstreamRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': origin || `https://${host}`,
        'X-Title': 'LifeOS',
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });

    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach OpenRouter', detail: e.message });
  }
}
