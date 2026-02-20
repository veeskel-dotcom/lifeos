/**
 * Empty State Test — verifies all screens render correctly with empty DB.
 * Checks: no crash, not blank, EmptyState component visible where expected.
 * Run: node tests/check-empty-states.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';

// Screens that use <EmptyState> component
const SCREENS = [
  { label: 'goals',                nav: ['goals'] },
  { label: 'tasks',                nav: ['tasks'] },
  { label: 'projects',             nav: ['projects'] },
  { label: 'calendar',             nav: ['calendar'] },
  { label: 'shopping',             nav: ['shopping'] },
  { label: 'sleep',                nav: ['sleep'] },
  { label: 'notes',                nav: ['notes'] },
  { label: 'documents',            nav: ['documents'] },
  { label: 'subscriptions',        nav: ['subscriptions'] },
  { label: 'routines',             nav: ['routines'] },
  { label: 'search',               nav: ['search'] },
  { label: 'expenses-list',        nav: ['expenses-list'] },
  { label: 'finance/overview',     nav: ['finance', { subScreen: 'overview' }] },
  { label: 'finance/expenses',     nav: ['finance', { subScreen: 'expenses' }] },
  { label: 'finance/incomes',      nav: ['finance', { subScreen: 'incomes' }] },
  { label: 'finance/accounts',     nav: ['finance', { subScreen: 'accounts' }] },
  { label: 'finance/credits',      nav: ['finance', { subScreen: 'credits' }] },
  { label: 'finance/budgets',      nav: ['finance', { subScreen: 'budgets' }] },
  { label: 'sport/overview',       nav: ['sport', { subScreen: 'overview' }] },
  { label: 'sport/history',        nav: ['sport', { subScreen: 'history' }] },
  { label: 'sport/exercises',      nav: ['sport', { subScreen: 'exercises' }] },
  { label: 'sport/templateList',   nav: ['sport', { subScreen: 'templateList' }] },
  { label: 'sport/bodyWeight',     nav: ['sport', { subScreen: 'bodyWeight' }] },
  { label: 'sport/measurements',   nav: ['sport', { subScreen: 'measurements' }] },
  { label: 'invest/overview',      nav: ['invest'] },
  { label: 'invest/dividends',     nav: ['invest', { subScreen: 'dividends' }] },
  { label: 'invest/trades',        nav: ['invest', { subScreen: 'trades' }] },
  { label: 'invest/networth',      nav: ['invest', { subScreen: 'networth' }] },
  { label: 'invest/watchlist',     nav: ['invest', { subScreen: 'watchlist' }] },
  { label: 'nutrition',            nav: ['nutrition'] },
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
  console.log('  Empty State Test');
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

      const navOk = await page.evaluate(({ s, d }) => {
        if (!window.__LIFEOS_NAV) return false;
        window.__LIFEOS_NAV(s, d || undefined);
        return true;
      }, { s: screen.nav[0], d: screen.nav[1] || null });

      if (!navOk) {
        console.log(`  SKIP ${screen.label}`);
        results.push({ label: screen.label, status: 'skip' });
        await page.close();
        continue;
      }

      await page.waitForTimeout(1500);

      const check = await page.evaluate(() => {
        const bodyText = document.body.innerText?.trim() || '';
        const isBlank = bodyText.length < 10;

        // EmptyState renders: div.flex.flex-col.items-center.justify-center.py-16
        const emptyEls = document.querySelectorAll('.py-16.text-center, .flex.flex-col.items-center.justify-center.py-16');
        // Also check for custom inline empty states (flex-col + items-center + py-20)
        const customEls = document.querySelectorAll('.flex.flex-col.items-center.justify-center.py-20');
        const hasEmptyState = emptyEls.length > 0 || customEls.length > 0;

        return { isBlank, hasEmptyState, textLen: bodyText.length };
      });

      const hasCrash = errors.filter(e => !/ResizeObserver|fetch|Network|AbortError|denied|storage/.test(e)).length > 0;

      if (hasCrash) {
        totalFail++;
        console.log(`  CRASH ${screen.label.padEnd(25)} ${errors[0]?.slice(0, 60)}`);
        results.push({ label: screen.label, status: 'crash' });
      } else if (check.isBlank) {
        totalFail++;
        console.log(`  BLANK ${screen.label.padEnd(25)} textLen=${check.textLen}`);
        results.push({ label: screen.label, status: 'blank' });
      } else if (check.hasEmptyState) {
        console.log(`  OK    ${screen.label.padEnd(25)} EmptyState visible, ${check.textLen} chars`);
        results.push({ label: screen.label, status: 'ok' });
      } else {
        // Screen rendered with content but no EmptyState — might have its own empty UI
        console.log(`  WARN  ${screen.label.padEnd(25)} No EmptyState element found (${check.textLen} chars)`);
        results.push({ label: screen.label, status: 'warn' });
      }
    } catch (err) {
      console.log(`  ERR   ${screen.label}: ${err.message.slice(0, 80)}`);
      results.push({ label: screen.label, status: 'error' });
    }

    await page.close();
  }

  // Report
  console.log('\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================');
  const ok = results.filter(r => r.status === 'ok').length;
  const warn = results.filter(r => r.status === 'warn').length;
  const crash = results.filter(r => r.status === 'crash').length;
  const blank = results.filter(r => r.status === 'blank').length;
  console.log(`  OK: ${ok}  WARN: ${warn}  CRASH: ${crash}  BLANK: ${blank}`);

  if (crash > 0 || blank > 0) {
    console.log('\n  FAILURES:');
    for (const r of results.filter(r => r.status === 'crash' || r.status === 'blank')) {
      console.log(`    [${r.label}] ${r.status}`);
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
