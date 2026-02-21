/**
 * sw.js — Service Worker (Workbox injectManifest)
 *
 * Стратегии:
 * 1. Precache App Shell (автоматически через __WB_MANIFEST)
 * 2. Google Fonts — Cache First, 1 год
 * 3. Images — Cache First, 30 дней
 * 4. Frankfurter (курсы) — Stale-While-Revalidate
 * 5. MOEX (котировки) — Network First, 5с timeout
 * 6. Open Food Facts — Stale-While-Revalidate
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ─── 1. Precache App Shell ──────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();
cleanupOutdatedCaches();

// SPA fallback — все навигации → index.html
const handler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(handler, { denylist: [/^\/api\//] }));

// ─── 2. Google Fonts — Cache First, 1 год ───────────────
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// ─── 3. Images — Cache First, 30 дней ───────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ─── 4. Frankfurter (курсы) — SWR ──────────────────────
registerRoute(
  ({ url }) => url.hostname === 'api.frankfurter.dev',
  new StaleWhileRevalidate({
    cacheName: 'currency-rates',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// ─── 5. MOEX (котировки) — Network First, 5с ───────────
registerRoute(
  ({ url }) => url.hostname === 'iss.moex.com',
  new NetworkFirst({
    cacheName: 'moex-quotes',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// ─── 6. Open Food Facts — SWR ───────────────────────────
registerRoute(
  ({ url }) => url.hostname.includes('openfoodfacts.org'),
  new StaleWhileRevalidate({
    cacheName: 'food-api',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ─── 7. FatSecret food search — SWR, 7 дней ────────────
registerRoute(
  ({url}) => url.pathname.startsWith('/api/proxy/fatsecret'),
  new StaleWhileRevalidate({
    cacheName: 'fatsecret-api',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// ─── 8. OpenRouter AI — NetworkOnly (не кэшировать) ─────
registerRoute(
  ({url}) => url.pathname.startsWith('/api/proxy/openrouter'),
  new NetworkOnly()
);

// ─── 9. Push notifications ──────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'lifeos',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ─── 8. SW update (skipWaiting по запросу) ──────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
