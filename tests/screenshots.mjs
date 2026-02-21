/**
 * screenshots.mjs — Take Playwright screenshots of ALL LifeOS screens.
 * Run: node tests/screenshots.mjs
 *
 * Requires the dev server at http://localhost:5199
 * Uses iPhone 14 viewport: 390x844
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENS_DIR = resolve(__dirname, 'screens');
const BASE = 'http://localhost:5199';

// Ensure output directory exists
mkdirSync(SCREENS_DIR, { recursive: true });

/**
 * Screen definitions.
 * type:
 *   'tab'    — click a tab in TabBar
 *   'nav'    — use __LIFEOS_NAV(screen, data)
 *   'module' — navigate to module via nav, then click UI to reach sub-screen
 */
const SCREENS = [
  // ═══ TAB SCREENS ═══
  { name: 'dashboard',     type: 'tab', tab: 'dashboard' },
  { name: 'tasks',         type: 'tab', tab: 'tasks' },
  { name: 'nutrition',     type: 'tab', tab: 'nutrition' },
  { name: 'more',          type: 'tab', tab: 'more' },

  // ═══ TOP-LEVEL SUB-SCREENS (via __LIFEOS_NAV) ═══
  { name: 'finance',       type: 'nav', screen: 'finance' },
  { name: 'sport',         type: 'nav', screen: 'sport' },
  { name: 'invest',        type: 'nav', screen: 'invest' },
  { name: 'health',        type: 'nav', screen: 'health' },
  { name: 'settings',      type: 'nav', screen: 'settings' },
  { name: 'ai-chat',       type: 'nav', screen: 'ai-chat' },
  { name: 'calendar',      type: 'nav', screen: 'calendar' },
  { name: 'routines',      type: 'nav', screen: 'routines' },
  { name: 'subscriptions', type: 'nav', screen: 'subscriptions' },
  { name: 'notes',         type: 'nav', screen: 'notes' },
  { name: 'documents',     type: 'nav', screen: 'documents' },
  { name: 'sleep',         type: 'nav', screen: 'sleep' },
  { name: 'shopping',      type: 'nav', screen: 'shopping' },
  { name: 'analytics',     type: 'nav', screen: 'analytics' },
  { name: 'notifications', type: 'nav', screen: 'notifications' },
  { name: 'utilities',     type: 'nav', screen: 'utilities' },
  { name: 'body-weight',   type: 'nav', screen: 'body-weight' },
  { name: 'goals',         type: 'nav', screen: 'goals' },
  { name: 'expenses-list', type: 'nav', screen: 'expenses-list' },
  { name: 'search',        type: 'nav', screen: 'search' },
  { name: 'weekly-report', type: 'nav', screen: 'weekly-report' },
  { name: 'projects',      type: 'nav', screen: 'projects' },
  { name: 'water',         type: 'nav', screen: 'water' },

  // ═══ FINANCE MODULE SUB-SCREENS ═══
  { name: 'finance--overview',  type: 'nav', screen: 'finance' },
  { name: 'finance--expenses',  type: 'module', module: 'finance', internalView: 'expenses' },
  { name: 'finance--incomes',   type: 'module', module: 'finance', internalView: 'incomes' },
  { name: 'finance--accounts',  type: 'module', module: 'finance', internalView: 'accounts' },
  { name: 'finance--credits',   type: 'module', module: 'finance', internalView: 'credits' },
  { name: 'finance--budgets',   type: 'module', module: 'finance', internalView: 'budgets' },

  // ═══ SPORT MODULE SUB-SCREENS ═══
  { name: 'sport--overview',      type: 'nav', screen: 'sport' },
  { name: 'sport--history',       type: 'module', module: 'sport', internalView: 'history' },
  { name: 'sport--exercises',     type: 'module', module: 'sport', internalView: 'exercises' },
  { name: 'sport--bodyWeight',    type: 'module', module: 'sport', internalView: 'bodyWeight' },
  { name: 'sport--measurements',  type: 'module', module: 'sport', internalView: 'measurements' },
  { name: 'sport--video',         type: 'module', module: 'sport', internalView: 'video' },

  // ═══ INVEST MODULE SUB-SCREENS ═══
  { name: 'invest--overview',   type: 'nav', screen: 'invest' },
  { name: 'invest--dividends',  type: 'module', module: 'invest', internalView: 'dividends' },
  { name: 'invest--trades',     type: 'module', module: 'invest', internalView: 'trades' },
  { name: 'invest--networth',   type: 'module', module: 'invest', internalView: 'networth' },

  // ═══ SETTINGS MODULE SUB-SCREENS ═══
  { name: 'settings--main',       type: 'nav', screen: 'settings' },
  { name: 'settings--profile',    type: 'module', module: 'settings', internalView: 'profile' },
  { name: 'settings--security',   type: 'module', module: 'settings', internalView: 'security' },
  { name: 'settings--ai',         type: 'module', module: 'settings', internalView: 'ai' },
  { name: 'settings--data',       type: 'module', module: 'settings', internalView: 'data' },
  { name: 'settings--appearance', type: 'module', module: 'settings', internalView: 'appearance' },

  // ═══ FORM SCREENS ═══
  { name: 'expense-form',      type: 'nav', screen: 'expense-form' },
  { name: 'income-form',       type: 'nav', screen: 'income-form' },
  { name: 'transfer-form',     type: 'nav', screen: 'transfer-form' },
  { name: 'task-form',         type: 'nav', screen: 'task-form' },
  { name: 'event-form',        type: 'nav', screen: 'event-form' },
  { name: 'routine-form',      type: 'nav', screen: 'routine-form' },
  { name: 'subscription-form', type: 'nav', screen: 'subscription-form' },
  { name: 'note-editor',       type: 'nav', screen: 'note-editor' },
  { name: 'document-form',     type: 'nav', screen: 'document-form' },
  { name: 'sleep-form',        type: 'nav', screen: 'sleep-form' },
  { name: 'goal-form',         type: 'nav', screen: 'goal-form' },
];

// ═══ HELPERS ═══

/**
 * Skip onboarding by setting has_completed_onboarding=true in LifeOS DB.
 * Must be called AFTER the app has initialized (DB exists with settings store).
 */
async function skipOnboarding(page) {
  // Wait for the app to init the DB and create the 'settings' store
  await page.evaluate(async () => {
    // The Dexie DB is called 'LifeOS'
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('LifeOS');
      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (!storeNames.includes('settings')) {
          db.close();
          resolve(false);
          return;
        }
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key: 'has_completed_onboarding', value: true });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      };
      req.onerror = () => resolve(false);
    });
  });
}

/**
 * Navigate to module sub-screen by using React fiber to find and call setState.
 * We traverse the React fiber tree to find the component with a 'view'/'setView' state.
 */
async function navigateModuleSubScreen(page, module, internalView) {
  // Strategy: use React DevTools-like fiber traversal to find the module's
  // state setter, then call it directly. This is more reliable than clicking.
  const success = await page.evaluate(({ module, view }) => {
    // Find React root
    const rootEl = document.getElementById('root') || document.querySelector('[data-reactroot]');
    if (!rootEl) return false;

    // Get React fiber
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
    if (!fiberKey) return false;

    let fiber = rootEl[fiberKey];

    // Traverse fiber tree to find module component with view/setView state
    const queue = [fiber];
    let found = false;

    while (queue.length > 0 && !found) {
      const node = queue.shift();
      if (!node) continue;

      // Check if this node has memoizedState with the view we want
      // React hooks are stored as a linked list in memoizedState
      if (node.memoizedState && node.stateNode === null) {
        // This is likely a function component — check its hooks
        let hookState = node.memoizedState;
        let hookIndex = 0;
        let viewHook = null;

        while (hookState) {
          const q = hookState.queue;
          if (q && typeof hookState.memoizedState === 'string') {
            // Found a string state — check if it's a view state
            const val = hookState.memoizedState;
            const possibleViews = ['overview', 'main', 'expenses', 'incomes', 'accounts',
              'credits', 'budgets', 'history', 'exercises', 'bodyWeight',
              'measurements', 'video', 'dividends', 'trades', 'networth',
              'profile', 'security', 'ai', 'data', 'appearance'];

            if (possibleViews.includes(val)) {
              viewHook = hookState;
            }
          }
          hookState = hookState.next;
          hookIndex++;
          if (hookIndex > 50) break; // Safety
        }

        if (viewHook) {
          // Found the view state hook — dispatch update
          const q = viewHook.queue;
          if (q && q.dispatch) {
            q.dispatch(view);
            found = true;
          }
        }
      }

      // Add children and siblings to queue
      if (node.child) queue.push(node.child);
      if (node.sibling) queue.push(node.sibling);
    }

    return found;
  }, { module, view: internalView });

  return success;
}

/**
 * Fallback: navigate to module sub-screen by clicking UI elements.
 */
async function clickModuleSubScreen(page, module, internalView) {
  // Map of module → view → possible click text labels
  const clickTargets = {
    finance: {
      expenses: ['Расходы', 'Все расходы', 'расходы'],
      incomes: ['Доходы', 'Все доходы', 'доходы'],
      accounts: ['Счета', 'Все счета', 'счета'],
      credits: ['Кредиты', 'Все кредиты', 'кредиты'],
      budgets: ['Бюджет', 'Бюджеты', 'бюджет'],
    },
    sport: {
      history: ['История', 'История тренировок', 'история'],
      exercises: ['Упражнения', 'Библиотека', 'упражнения'],
      bodyWeight: ['Вес тела', 'Вес', 'вес'],
      measurements: ['Замеры', 'Обмеры', 'замеры'],
      video: ['Видеоанализ', 'Видео', 'видео'],
    },
    invest: {
      dividends: ['Дивиденды', 'дивиденды', 'Календарь дивидендов'],
      trades: ['Сделки', 'сделки', 'История сделок'],
      networth: ['Капитал', 'капитал', 'Чистый капитал'],
    },
    settings: {
      profile: ['Профиль', 'профиль'],
      security: ['Безопасность', 'PIN', 'безопасность'],
      ai: ['AI помощник', 'AI', 'Искусственный интеллект'],
      data: ['Данные', 'Экспорт', 'данные'],
      appearance: ['Оформление', 'Тема', 'оформление'],
    },
  };

  const labels = clickTargets[module]?.[internalView] || [];

  for (const label of labels) {
    const clicked = await page.evaluate((labelText) => {
      // Search through all clickable-looking elements
      const selectors = 'button, a, [role="button"], [onClick], div[style*="cursor"], span, p, div';
      const elements = document.querySelectorAll(selectors);

      for (const el of elements) {
        // Check direct text content (not nested children text)
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent.trim())
          .join('');

        const fullText = el.textContent?.trim() || '';

        if (directText === labelText || fullText === labelText) {
          el.click();
          return true;
        }
      }

      // Partial match fallback
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        if (text.includes(labelText) && text.length < labelText.length * 3) {
          el.click();
          return true;
        }
      }

      return false;
    }, label);

    if (clicked) {
      await page.waitForTimeout(1000);
      return true;
    }
  }

  return false;
}

async function takeScreenshot(page, name) {
  const path = resolve(SCREENS_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

// ═══ MAIN ═══

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });

  console.log(`\nLifeOS Screenshot Tool — ${SCREENS.length} screens\n`);

  // ── Step 1: Load app, wait for DB init, skip onboarding ──
  const setupPage = await context.newPage();
  setupPage.on('pageerror', () => {}); // suppress errors

  await setupPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  // Wait for app to fully initialize (creates DB, seeds, etc.)
  await setupPage.waitForTimeout(3000);

  // Now the DB should exist with settings store
  await skipOnboarding(setupPage);
  console.log('Onboarding flag set. Reloading...');

  // Reload to pick up the setting
  await setupPage.reload({ waitUntil: 'networkidle' });
  await setupPage.waitForTimeout(3000);

  // Verify we passed onboarding
  const bodyText = await setupPage.locator('body').innerText();
  const passedOnboarding = !bodyText.includes('Начать настройку') || bodyText.length > 300;
  if (!passedOnboarding) {
    console.log('WARNING: Still on onboarding. Trying again with longer wait...');
    await skipOnboarding(setupPage);
    await setupPage.reload({ waitUntil: 'networkidle' });
    await setupPage.waitForTimeout(5000);
    const bodyText2 = await setupPage.locator('body').innerText();
    if (bodyText2.includes('Начать настройку') && bodyText2.length < 300) {
      console.error('FATAL: Cannot skip onboarding. Aborting.');
      await browser.close();
      process.exit(2);
    }
  }
  console.log('Onboarding skipped successfully.\n');

  // Keep setup page open (maintains IndexedDB in context)
  // We use it as a reference; new pages in same context share the DB

  const results = { ok: 0, fail: 0, skip: 0, warns: [] };

  for (const item of SCREENS) {
    const page = await context.newPage();
    page.on('pageerror', () => {}); // Suppress console noise

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      if (item.type === 'tab') {
        // Click on tab bar button
        if (item.tab !== 'dashboard') {
          // Dashboard is the default tab, no need to click
          const tabClicked = await page.evaluate((tabId) => {
            const tabLabels = {
              dashboard: 'Главная',
              tasks: 'Задачи',
              nutrition: 'Еда',
              more: 'Ещё',
            };
            const label = tabLabels[tabId];
            // Find all buttons at the bottom (TabBar)
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
              if (btn.textContent?.trim().includes(label)) {
                btn.click();
                return true;
              }
            }
            return false;
          }, item.tab);

          if (!tabClicked) {
            console.warn(`  WARN: Could not click tab: ${item.tab}`);
          }
          await page.waitForTimeout(1000);
        }

      } else if (item.type === 'nav') {
        const hasNav = await page.evaluate(({ screen, data }) => {
          if (!window.__LIFEOS_NAV) return false;
          window.__LIFEOS_NAV(screen, data || undefined);
          return true;
        }, { screen: item.screen, data: item.data || null });

        if (!hasNav) {
          console.log(`  SKIP ${item.name} — __LIFEOS_NAV not available`);
          results.skip++;
          await page.close();
          continue;
        }
        await page.waitForTimeout(1500);

      } else if (item.type === 'module') {
        // First navigate to the module
        const hasNav = await page.evaluate((screen) => {
          if (!window.__LIFEOS_NAV) return false;
          window.__LIFEOS_NAV(screen);
          return true;
        }, item.module);

        if (!hasNav) {
          console.log(`  SKIP ${item.name} — __LIFEOS_NAV not available`);
          results.skip++;
          await page.close();
          continue;
        }
        await page.waitForTimeout(1500);

        // Try React fiber approach first
        let navigated = await navigateModuleSubScreen(page, item.module, item.internalView);

        if (!navigated) {
          // Fallback: click-based navigation
          navigated = await clickModuleSubScreen(page, item.module, item.internalView);
        }

        if (!navigated) {
          const msg = `Could not navigate to ${item.module}.${item.internalView} — screenshot shows module root`;
          console.warn(`  WARN: ${msg}`);
          results.warns.push(msg);
        }
        await page.waitForTimeout(800);
      }

      // Take screenshot
      await takeScreenshot(page, item.name);
      console.log(`  OK  ${item.name}`);
      results.ok++;

    } catch (err) {
      console.log(`  FAIL ${item.name} — ${err.message.slice(0, 120)}`);
      results.fail++;
    }

    await page.close();
  }

  await setupPage.close();

  // ═══ REPORT ═══
  console.log('\n' + '='.repeat(50));
  console.log(`\nScreenshot Results:`);
  console.log(`  Total:   ${SCREENS.length}`);
  console.log(`  OK:      ${results.ok}`);
  console.log(`  Failed:  ${results.fail}`);
  console.log(`  Skipped: ${results.skip}`);
  if (results.warns.length > 0) {
    console.log(`  Warnings: ${results.warns.length}`);
    for (const w of results.warns) console.log(`    - ${w}`);
  }
  console.log(`\nScreenshots saved to: ${SCREENS_DIR}\n`);

  await browser.close();
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
