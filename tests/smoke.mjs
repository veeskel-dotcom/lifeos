/**
 * Full Smoke test — Playwright обходит ВСЕ экраны LifeOS.
 * Запуск: node tests/smoke.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';

// ═══ ALL SCREENS ═══
// format: { name, nav: [screen] or [screen, data] }
const ALL = [
  // ── Top-level (App.jsx) ──
  ...[
    'dashboard', 'finance', 'tasks', 'nutrition', 'sport', 'more',
    'invest', 'health', 'settings', 'ai-chat', 'calendar',
    'routines', 'routine-form', 'subscriptions', 'subscription-form',
    'notes', 'note-editor', 'documents', 'document-form',
    'sleep', 'sleep-form', 'sleep-add',
    'shopping', 'barcode-scanner', 'water',
    'analytics', 'notifications', 'utilities',
    'body-weight', 'goals', 'goal-form',
    'expenses-list', 'expense-form', 'income-form', 'transfer-form',
    'finance-analytics',
    'task-form', 'projects', 'event-form', 'week-grid',
    'weekly-report', 'search', 'active-workout', 'food-search',
  ].map(s => ({ name: s, nav: [s] })),

  // ── Finance module sub-screens ──
  ...['overview', 'expenses', 'incomes', 'accounts', 'credits',
      'budgets', 'analytics', 'finance-tools', 'utilities',
  ].map(s => ({ name: `finance→${s}`, nav: ['finance', { subScreen: s }] })),

  // ── Sport module sub-screens ──
  ...['overview', 'history', 'exercises', 'bodyWeight', 'progress',
      'prList', 'measurements', 'photos', 'video', 'aiTrainer', 'templateList',
  ].map(s => ({ name: `sport→${s}`, nav: ['sport', { subScreen: s }] })),

  // ── Invest module sub-screens ──
  ...['dividends', 'trades', 'networth', 'watchlist', 'tax', 'invest-tools',
  ].map(s => ({ name: `invest→${s}`, nav: ['invest', { subScreen: s }] })),

  // ── Settings module sub-screens ──
  ...['profile', 'security', 'ai', 'data', 'notifications',
      'analytics', 'about', 'appearance', 'error-log',
  ].map(s => ({ name: `settings→${s}`, nav: ['settings', { subScreen: s }] })),
];

function filterNoise(errors) {
  return errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('Failed to fetch') &&
    !e.includes('NetworkError') &&
    !e.includes('Load failed') &&
    !e.includes('AbortError') &&
    !e.includes('navigator.serviceWorker') &&
    !e.includes('Notification') &&
    !e.includes('denied') &&
    !e.includes('QuotaExceeded') &&
    !e.includes('storage') &&
    !e.includes('The operation is insecure') &&
    !e.includes('insecure')
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log(`🚀 LifeOS Full Smoke — ${ALL.length} screens\n`);

  // Skip onboarding via app's Dexie instance
  const setupPage = await context.newPage();
  await setupPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await setupPage.waitForTimeout(3000);
  await setupPage.evaluate(async () => {
    try {
      const mod = await import('/db/index.js');
      const db = mod.db || mod.default;
      await db.settings.put({ key: 'has_completed_onboarding', value: true });
    } catch (e) { /* DB may not be ready yet */ }
  });
  await setupPage.close();

  const results = [];

  for (const item of ALL) {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);

      // Navigate
      const hasNav = await page.evaluate(({ screen, data }) => {
        if (!window.__LIFEOS_NAV) return false;
        window.__LIFEOS_NAV(screen, data || undefined);
        return true;
      }, { screen: item.nav[0], data: item.nav[1] || null });

      if (!hasNav) {
        results.push({ name: item.name, status: 'SKIP' });
        await page.close();
        continue;
      }

      await page.waitForTimeout(1800);

      const bodyText = await page.locator('body').innerText();
      const critical = filterNoise(pageErrors);

      if (critical.length > 0) {
        results.push({ name: item.name, status: 'FAIL', errors: critical });
      } else if (bodyText.length <= 5) {
        results.push({ name: item.name, status: 'FAIL', errors: ['Blank page'] });
      } else {
        results.push({ name: item.name, status: 'OK' });
      }
    } catch (err) {
      results.push({ name: item.name, status: 'FAIL', errors: [err.message.slice(0, 200)] });
    }

    await page.close();

    // Progress
    const r = results[results.length - 1];
    const icon = r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭' : '❌';
    process.stdout.write(`${icon} ${r.name}${r.status === 'FAIL' ? ' — ' + r.errors[0].slice(0, 80) : ''}\n`);
  }

  // ═══ REPORT ═══
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log('\n═══════════════════════════════════════════');
  console.log(`  ИТОГО: ${results.length} экранов`);
  console.log(`  ✅ ${passed} OK   ❌ ${failed} FAIL   ⏭ ${skipped} SKIP`);
  console.log('═══════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n❌ Экраны с ошибками:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  ${r.name}:`);
      for (const e of r.errors) console.log(`    └─ ${e.slice(0, 150)}`);
    }
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(2); });
