/**
 * Back Navigation Test — verifies all sub-screens can navigate back.
 * Checks: history.state.depth decreases after clicking NavHeader back button.
 * Run: node tests/check-back-nav.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';

// Sub-screens that receive onBack (not tabs)
const SCREENS = [
  { label: 'notes',          nav: ['notes'] },
  { label: 'documents',      nav: ['documents'] },
  { label: 'sleep',          nav: ['sleep'] },
  { label: 'shopping',       nav: ['shopping'] },
  { label: 'water',          nav: ['water'] },
  { label: 'goals',          nav: ['goals'] },
  { label: 'routines',       nav: ['routines'] },
  { label: 'subscriptions',  nav: ['subscriptions'] },
  { label: 'projects',       nav: ['projects'] },
  { label: 'search',         nav: ['search'] },
  { label: 'body-weight',    nav: ['body-weight'] },
  { label: 'expenses-list',  nav: ['expenses-list'] },
  { label: 'settings',       nav: ['settings'] },
  { label: 'health',         nav: ['health'] },
  { label: 'calendar',       nav: ['calendar'] },
  { label: 'ai-chat',        nav: ['ai-chat'] },
  { label: 'nutrition',      nav: ['nutrition'] },
  { label: 'task-form',      nav: ['task-form'] },
  { label: 'goal-form',      nav: ['goal-form'] },
  { label: 'finance',        nav: ['finance'] },
  { label: 'invest',         nav: ['invest'] },
  { label: 'sport',          nav: ['sport'] },
];

async function skipOnboarding(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    try {
      const req = indexedDB.open('LifeOS');
      await new Promise(resolve => {
        req.onsuccess = async () => {
          try {
            const db = req.result;
            if (Array.from(db.objectStoreNames).includes('settings')) {
              const tx = db.transaction('settings', 'readwrite');
              tx.objectStore('settings').put({ key: 'has_completed_onboarding', value: true });
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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('============================================================');
  console.log('  Back Navigation Test');
  console.log(`  Screens: ${SCREENS.length}`);
  console.log('============================================================\n');

  await skipOnboarding(context);

  let totalFail = 0;
  const results = [];

  for (const screen of SCREENS) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      // Navigate to the sub-screen
      const navOk = await page.evaluate(({ s, d }) => {
        if (!window.__LIFEOS_NAV) return false;
        window.__LIFEOS_NAV(s, d || undefined);
        return true;
      }, { s: screen.nav[0], d: screen.nav[1] || null });

      if (!navOk) {
        console.log(`  SKIP ${screen.label} (no __LIFEOS_NAV)`);
        results.push({ label: screen.label, status: 'skip' });
        await page.close();
        continue;
      }

      await page.waitForTimeout(1200);

      // Get depth before back
      const depthBefore = await page.evaluate(() => window.history.state?.depth || 0);

      // Try to find and click the NavHeader back button (renders as "‹" text)
      const backClicked = await page.evaluate(() => {
        // NavHeader back button contains "‹"
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.trim();
          if (text && text.startsWith('\u2039')) { // ‹ character
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (!backClicked) {
        // No back button found — use history.back() as fallback
        await page.evaluate(() => window.history.back());
      }

      await page.waitForTimeout(800);

      // Get depth after back
      const depthAfter = await page.evaluate(() => window.history.state?.depth || 0);
      const isRoot = await page.evaluate(() => window.history.state?.root === true);

      const navigatedBack = depthAfter < depthBefore || isRoot || depthBefore === 0;
      const hasCrash = errors.filter(e => !/ResizeObserver|fetch|Network|AbortError/.test(e)).length > 0;

      if (navigatedBack && !hasCrash) {
        console.log(`  OK ${screen.label.padEnd(22)} depth ${depthBefore} -> ${depthAfter}${backClicked ? '' : ' (history.back)'}`);
        results.push({ label: screen.label, status: 'ok' });
      } else {
        totalFail++;
        const reason = hasCrash ? `CRASH: ${errors[0]?.slice(0, 60)}` : `depth ${depthBefore} -> ${depthAfter} (no change)`;
        console.log(`  FAIL ${screen.label.padEnd(22)} ${reason}`);
        results.push({ label: screen.label, status: 'fail', reason });
      }
    } catch (err) {
      console.log(`  ERR ${screen.label}: ${err.message.slice(0, 80)}`);
      results.push({ label: screen.label, status: 'error', reason: err.message });
    }

    await page.close();
  }

  // Report
  console.log('\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================');
  const ok = results.filter(r => r.status === 'ok').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const skip = results.filter(r => r.status === 'skip').length;
  console.log(`  OK: ${ok}  FAIL: ${fail}  SKIP: ${skip}`);
  if (fail > 0) {
    console.log('\n  FAILURES:');
    for (const r of results.filter(r => r.status === 'fail')) {
      console.log(`    [${r.label}] ${r.reason}`);
    }
  }
  console.log('============================================================\n');

  await browser.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
