/**
 * Click Navigation Test -- Playwright clicks ALL clickable elements on each screen.
 * Checks for uncaught exceptions (pageerror) after each click.
 * Run: node tests/click-nav.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';

const SCREENS = [
  { name: 'dashboard',  nav: ['dashboard'] },
  { name: 'finance',    nav: ['finance'] },
  { name: 'tasks',      nav: ['tasks'] },
  { name: 'nutrition',  nav: ['nutrition'] },
  { name: 'sport',      nav: ['sport'] },
  { name: 'more',       nav: ['more'] },
  { name: 'invest',     nav: ['invest'] },
  { name: 'health',     nav: ['health'] },
  { name: 'settings',   nav: ['settings'] },
];

const NOISE_PATTERNS = [
  'ResizeObserver', 'Failed to fetch', 'NetworkError', 'Load failed',
  'AbortError', 'navigator.serviceWorker', 'serviceWorker',
  'Notification', 'denied', 'QuotaExceeded', 'storage',
  'The operation is insecure', 'insecure',
];

function isNoise(msg) {
  return NOISE_PATTERNS.some(p => msg.includes(p));
}

async function skipOnboarding(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    try {
      const req = indexedDB.open('lifeos');
      await new Promise((resolve) => {
        req.onsuccess = async () => {
          try {
            const db = req.result;
            if (Array.from(db.objectStoreNames).includes('settings')) {
              const tx = db.transaction('settings', 'readwrite');
              tx.objectStore('settings').put({ key: 'onboarding_complete', value: 'true' });
              await new Promise(r => { tx.oncomplete = r; });
            }
          } catch {}
          resolve();
        };
        req.onerror = resolve;
      });
    } catch {}
  });
  await page.close();
}

async function navigateTo(page, screen, data) {
  const ok = await page.evaluate(({ screen, data }) => {
    if (!window.__LIFEOS_NAV) return false;
    window.__LIFEOS_NAV(screen, data || undefined);
    return true;
  }, { screen, data: data || null });
  if (ok) await page.waitForTimeout(1500);
  return ok;
}

async function findClickables(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const results = [];
    const candidates = new Set();

    // Standard clickable elements
    for (const el of document.querySelectorAll('button, a, [role="button"], [onclick], [data-click]')) {
      candidates.add(el);
    }

    // Elements with pointer cursor
    for (const el of document.querySelectorAll('*')) {
      const style = window.getComputedStyle(el);
      if (style.cursor === 'pointer') candidates.add(el);
    }

    // React onClick handlers
    for (const el of document.querySelectorAll('*')) {
      for (const key of Object.keys(el)) {
        if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
          try {
            let fiber = el[key];
            for (let i = 0; i < 5 && fiber; i++) {
              if (fiber.memoizedProps && typeof fiber.memoizedProps.onClick === 'function') {
                candidates.add(el);
                break;
              }
              fiber = fiber.return;
            }
          } catch {}
          break;
        }
      }
    }

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.top > window.innerHeight + 200) continue;
      if (rect.bottom < 0) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      const posKey = Math.round(rect.left) + ',' + Math.round(rect.top) + ',' + Math.round(rect.width) + ',' + Math.round(rect.height);
      if (seen.has(posKey)) continue;
      seen.add(posKey);

      let text = (el.textContent || '').trim().substring(0, 60).replaceAll(String.fromCharCode(10), ' ');
      if (!text) text = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (!text) text = el.tagName.toLowerCase();

      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = '#' + el.id;
      } else if (el.getAttribute('data-testid')) {
        selector = '[data-testid="' + el.getAttribute('data-testid') + '"]';
      } else if (el.className && typeof el.className === 'string') {
        const cls = el.className.split(' ').filter(c => c && c.length < 40).slice(0, 2).join('.');
        if (cls) selector += '.' + cls;
      }

      results.push({
        index: results.length,
        tag: el.tagName.toLowerCase(),
        text: text.substring(0, 60),
        selector,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      });
    }

    return results;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('============================================================');
  console.log('  LifeOS Click Navigation Test');
  console.log('  Testing all clickable elements on each major screen');
  console.log('============================================================');
  console.log('');

  console.log('[SETUP] Skipping onboarding...');
  await skipOnboarding(context);
  console.log('[SETUP] Done.');
  console.log('');

  const report = [];

  for (const screen of SCREENS) {
    console.log('------------------------------------------------------------');
    console.log('[SCREEN] ' + screen.name);
    console.log('------------------------------------------------------------');

    const page = await context.newPage();
    const allPageErrors = [];
    page.on('pageerror', err => allPageErrors.push(err.message));

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);

      const navOk = await navigateTo(page, screen.nav[0], screen.nav[1]);
      if (!navOk) {
        console.log('  [SKIP] __LIFEOS_NAV not available');
        report.push({ screen: screen.name, total: 0, clicked: 0, crashes: [], skipped: true });
        await page.close();
        continue;
      }

      // Scroll to discover more elements
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      const clickables = await findClickables(page);
      console.log('  Found ' + clickables.length + ' clickable elements');

      const crashes = [];
      let clickedCount = 0;

      for (const item of clickables) {
        const errorsBefore = allPageErrors.length;

        try {
          // Re-navigate to ensure clean state before each click
          await navigateTo(page, screen.nav[0], screen.nav[1]);
          await page.waitForTimeout(300);

          const preClickLen = allPageErrors.length;

          // Click by coordinates
          await page.mouse.click(item.x, item.y);
          clickedCount++;

          // Wait for reactions
          await page.waitForTimeout(1000);

          // Collect new errors since the click
          const newErrors = allPageErrors.slice(preClickLen).filter(e => !isNoise(e));

          if (newErrors.length > 0) {
            const crash = {
              element: item.text || item.selector,
              tag: item.tag,
              selector: item.selector,
              pos: item.x + ',' + item.y,
              errors: newErrors.map(e => e.substring(0, 200)),
            };
            crashes.push(crash);
            console.log('  [CRASH] "' + item.text.substring(0, 40) + '" (' + item.selector + ')');
            for (const e of newErrors) {
              console.log('          -> ' + e.substring(0, 120));
            }
          }

        } catch (clickErr) {
          if (!clickErr.message.includes('Target closed') &&
              !clickErr.message.includes('Execution context') &&
              !clickErr.message.includes('frame was detached') &&
              !clickErr.message.includes('Protocol error')) {
            const newErrors = allPageErrors.slice(errorsBefore).filter(e => !isNoise(e));
            if (newErrors.length > 0) {
              crashes.push({
                element: item.text || item.selector,
                tag: item.tag,
                selector: item.selector,
                pos: item.x + ',' + item.y,
                errors: newErrors.map(e => e.substring(0, 200)),
              });
            }
          }
        }
      }

      console.log('  Clicked: ' + clickedCount + '/' + clickables.length);
      if (crashes.length === 0) {
        console.log('  Result: OK (no crashes)');
      } else {
        console.log('  Result: ' + crashes.length + ' crash(es) found');
      }

      report.push({
        screen: screen.name,
        total: clickables.length,
        clicked: clickedCount,
        crashes,
        skipped: false,
      });

    } catch (err) {
      console.log('  [ERROR] ' + err.message.substring(0, 200));
      report.push({
        screen: screen.name,
        total: 0,
        clicked: 0,
        crashes: [{ element: 'SCREEN_LOAD', errors: [err.message.substring(0, 200)] }],
        skipped: false,
      });
    }

    await page.close();
    console.log('');
  }

  // ============ FINAL REPORT ============
  console.log('');
  console.log('============================================================');
  console.log('  FINAL REPORT -- Click Navigation Test');
  console.log('============================================================');
  console.log('');

  let totalElements = 0;
  let totalCrashes = 0;

  console.log('  Screen              | Elements | Clicked | Crashes');
  console.log('  --------------------|----------|---------|--------');
  for (const r of report) {
    totalElements += r.total;
    totalCrashes += r.crashes.length;
    const pad1 = r.screen.padEnd(20);
    const pad2 = String(r.total).padStart(8);
    const pad3 = String(r.clicked || 0).padStart(7);
    const pad4 = String(r.crashes.length).padStart(7);
    const status = r.skipped ? ' (SKIP)' : (r.crashes.length > 0 ? ' <<<' : '');
    console.log('  ' + pad1 + '|' + pad2 + ' |' + pad3 + ' |' + pad4 + status);
  }
  console.log('  --------------------|----------|---------|--------');
  console.log('  ' + 'TOTAL'.padEnd(20) + '|' + String(totalElements).padStart(8) + ' |' + '       ' + ' |' + String(totalCrashes).padStart(7));
  console.log('');

  if (totalCrashes > 0) {
    console.log('  CRASHES DETAIL:');
    console.log('  ===============');
    for (const r of report) {
      if (r.crashes.length === 0) continue;
      console.log('');
      console.log('  [' + r.screen + ']');
      for (const c of r.crashes) {
        console.log('    Element: "' + (c.element || 'unknown') + '"');
        if (c.tag) console.log('    Tag: ' + c.tag + ' | Selector: ' + c.selector);
        if (c.pos) console.log('    Position: ' + c.pos);
        for (const e of c.errors) {
          console.log('    Error: ' + e);
        }
        console.log('');
      }
    }
  } else {
    console.log('  No crashes detected across all screens.');
  }

  console.log('');
  await browser.close();
  process.exit(totalCrashes > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
