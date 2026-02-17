/**
 * Vercel Serverless Function: /api/proxy/fatsecret
 * Proxies requests to FatSecret API, handling OAuth server-side.
 *
 * Environment variables required (set in Vercel dashboard, no VITE_ prefix):
 *   FATSECRET_CLIENT_ID
 *   FATSECRET_CLIENT_SECRET
 */

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Server-side token cache (survives across requests in the same lambda instance)
let tokenCache = { token: null, expiresAt: 0 };

async function getToken(clientId, clientSecret) {
  // Return cached token if still valid
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'basic',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FatSecret OAuth failed: HTTP ${res.status} — ${errText}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s safety margin
  };

  return tokenCache.token;
}

export default async function handler(req, res) {
  // Allow GET (search params in query) and POST (search params in body)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Origin check
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (origin && !origin.includes(host) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden: origin mismatch' });
  }

  // Validate server config
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server misconfiguration: FatSecret credentials not set' });
  }

  // Get request params from query (GET) or body (POST)
  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { method: apiMethod, ...restParams } = params;

  if (!apiMethod) {
    return res.status(400).json({ error: 'Missing required parameter: method (e.g., foods.search.v3)' });
  }

  try {
    // Get OAuth token (server-side, credentials never exposed)
    const token = await getToken(clientId, clientSecret);

    // Build FatSecret API request
    const searchParams = new URLSearchParams({
      method: apiMethod,
      format: 'json',
      ...restParams,
    });

    const apiRes = await fetch(`${API_URL}?${searchParams}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(apiRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (e) {
    // If token expired, clear cache and retry once
    if (e.message?.includes('OAuth') || e.message?.includes('401')) {
      tokenCache = { token: null, expiresAt: 0 };
    }
    return res.status(502).json({ error: 'Failed to reach FatSecret', detail: e.message });
  }
}
