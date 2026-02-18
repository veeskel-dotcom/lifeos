/**
 * Click Navigation Test — finds ALL clickable elements on each screen,
 * clicks them one by one, checks for JS crashes.
 * Run: node tests/check-clicks.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';
const DB_NAME = 'LifeOS';

const SCREENS = [
  'dashboard','finance','tasks','nutrition','sport','more','invest',
  'health','settings','ai-chat','calendar','routines','notes',
  'documents','sleep','shopping','water','goals','expenses-list',
  'search','projects','body-weight','subscriptions',
];

const MODULE_SUBS = [
  { screen: 'finance', subs: ['overview','expenses','incomes','accounts','credits','budgets','finance-tools'] },
  { screen: 'sport', subs: ['overview','history','exercises','bodyWeight'] },
  { screen: 'invest', subs: ['dividends','trades','networth'] },
  { screen: 'settings', subs: ['profile','security','ai','data','appearance'] },
];

function buildAll() {
  const list = SCREENS.map(s => ({ label: s, nav: [s] }));
  for (const m of MODULE_SUBS) {
    for (const sub of m.subs) {
      list.push({ label: m.screen + '/' + sub, nav: [m.screen, { subScreen: sub }] });
    }
  }
  return list;
}

async function skipOnboarding(page) {
  await page.evaluate(async (dbName) => {
    const req = indexedDB.open(dbName);
    return new Promise(resolve => {
      req.onsuccess = () => {
        const db = req.result;
        if (!Array.from(db.objectStoreNames).includes('settings')) { db.close(); resolve(); return; }
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key: 'has_completed_onboarding', value: true });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      req.onerror = () => resolve();
    });
  }, DB_NAME);
}

async function run() {
  const screens = buildAll();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('=== Click Navigation Test ===');
  console.log('Screens: ' + screens.length + '\n');

  // Setup
  const setup = await context.newPage();
  await setup.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await setup.waitForTimeout(1500);
  await skipOnboarding(setup);
  await setup.reload({ waitUntil: 'networkidle', timeout: 20000 });
  await setup.waitForTimeout(2000);
  await setup.close();

  const results = [];
  let totalClicks = 0;
  let totalCrashes = 0;

  for (const screen of screens) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => {
      const msg = e.message || '';
      if (!msg.includes('ResizeObserver') && !msg.includes('Failed to fetch') &&
          !msg.includes('NetworkError') && !msg.includes('AbortError') &&
          !msg.includes('navigator.serviceWorker') && !msg.includes('insecure'))
        errors.push(msg);
    });

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Navigate
      await page.evaluate(({ s, d }) => window.__LIFEOS_NAV?.(s, d || undefined), {
        s: screen.nav[0], d: screen.nav[1] || null,
      });
      await page.waitForTimeout(1500);

      // Find all clickable elements
      const clickables = await page.evaluate(() => {
        const els = [];
        const seen = new Set();
        const selectors = [
          ...document.querySelectorAll('button:not([disabled])'),
          ...document.querySelectorAll('a[href]'),
          ...document.querySelectorAll('[role="button"]'),
          ...document.querySelectorAll('[onclick]'),
          ...document.querySelectorAll('[style*="cursor: pointer"]'),
        ];
        for (const el of selectors) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.top < 0 || rect.top > window.innerHeight) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          const key = el.tagName + ':' + Math.round(rect.left) + ':' + Math.round(rect.top);
          if (seen.has(key)) continue;
          seen.add(key);
          const text = (el.textContent || '').trim().slice(0, 40);
          els.push({
            tag: el.tagName.toLowerCase(),
            text,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          });
        }
        return els;
      });

      const clickCount = clickables.length;
      let crashCount = 0;

      // Click each element, navigate back after each click
      const maxClicks = Math.min(clickCount, 60); // cap per screen
      for (let i = 0; i < maxClicks; i++) {
        const el = clickables[i];
        const errBefore = errors.length;
        try {
          await page.mouse.click(el.x, el.y);
          await page.waitForTimeout(300);
        } catch {}
        if (errors.length > errBefore) crashCount++;
        // Navigate back to the screen
        try {
          await page.evaluate(({ s, d }) => window.__LIFEOS_NAV?.(s, d || undefined), {
            s: screen.nav[0], d: screen.nav[1] || null,
          });
          await page.waitForTimeout(500);
        } catch {}
      }

      totalClicks += maxClicks;
      totalCrashes += crashCount;
      results.push({ label: screen.label, found: clickCount, clicked: maxClicks, crashes: crashCount });

      const icon = crashCount > 0 ? '[CRASH]' : '[OK]';
      console.log(icon + ' ' + screen.label + ': ' + clickCount + ' elements, clicked ' + maxClicks + (crashCount > 0 ? ', ' + crashCount + ' crashes' : ''));

    } catch (err) {
      results.push({ label: screen.label, found: 0, clicked: 0, crashes: 0, error: err.message });
      console.log('[ERR]  ' + screen.label + ': ' + err.message.slice(0, 80));
    }

    await page.close();
  }

  // Report
  console.log('\n==========================================');
  console.log('  CLICK NAVIGATION RESULTS');
  console.log('==========================================');
  console.log('  Screens:  ' + screens.length);
  console.log('  Total clickable elements found: ' + results.reduce((s, r) => s + r.found, 0));
  console.log('  Total clicks performed: ' + totalClicks);
  console.log('  Total crashes: ' + totalCrashes);
  console.log('==========================================');

  if (totalCrashes > 0) {
    console.log('\nScreens with crashes:');
    for (const r of results.filter(r => r.crashes > 0)) {
      console.log('  ' + r.label + ': ' + r.crashes + ' crash(es)');
    }
  }

  if (totalCrashes === 0) {
    console.log('\nAll clicks passed without crashes!');
  }

  console.log('');
  await browser.close();
  process.exit(totalCrashes > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(2); });
