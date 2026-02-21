/**
 * Smoke test — Playwright обходит все экраны LifeOS
 * и проверяет: нет JS page-errors (uncaught exceptions), страница не пустая.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5199';

// All navigable screens from App.jsx
const SCREENS = [
  'dashboard',
  'finance',
  'tasks',
  'nutrition',
  'sport',
  'more',
  'invest',
  'health',
  'settings',
  'ai-chat',
  'calendar',
  'routines',
  'subscriptions',
  'notes',
  'documents',
  'sleep',
  'shopping',
  'analytics',
  'notifications',
  'utilities',
  'body-weight',
  'goals',
  'expenses-list',
  'search',
];

// Load app and skip onboarding
async function loadApp(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  // Skip onboarding by setting flag in IndexedDB
  await page.evaluate(async () => {
    // Open Dexie DB directly
    const req = indexedDB.open('lifeos');
    await new Promise((resolve, reject) => {
      req.onsuccess = async () => {
        try {
          const db = req.result;
          const tx = db.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          store.put({ key: 'onboarding_complete', value: 'true' });
          await new Promise(r => { tx.oncomplete = r; });
        } catch (e) { /* DB may not be ready yet */ }
        resolve();
      };
      req.onerror = resolve; // continue anyway
      req.onupgradeneeded = () => {
        // Don't interfere with Dexie schema
        resolve();
      };
    });
  });

  // Reload after setting onboarding flag
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('LifeOS Smoke Tests', () => {
  test('App loads — no white screen', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await loadApp(page);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
    expect(pageErrors.filter(e => !e.includes('ResizeObserver'))).toEqual([]);
  });

  for (const screen of SCREENS) {
    test(`Screen: ${screen}`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      await loadApp(page);

      // Navigate via exposed function
      const hasNav = await page.evaluate((s) => {
        if (window.__LIFEOS_NAV) {
          window.__LIFEOS_NAV(s);
          return true;
        }
        return false;
      }, screen);

      if (!hasNav) {
        test.skip();
        return;
      }

      // Wait for lazy load + render
      await page.waitForTimeout(2000);

      // Page should not be blank
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(5);

      // No uncaught exceptions (filter noise)
      const critical = pageErrors.filter(e =>
        !e.includes('ResizeObserver') &&
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('Load failed') &&
        !e.includes('AbortError')
      );

      if (critical.length > 0) {
        console.log(`\n❌ [${screen}] PAGE ERRORS:`, critical);
      }
      expect(critical).toEqual([]);
    });
  }
});
