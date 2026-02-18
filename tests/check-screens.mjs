/**
 * Full Screenshot Test — captures ALL screens (79+) for visual review.
 * Run: node tests/check-screens.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, 'screens-all');
const BASE = 'http://localhost:5199';
const DB_NAME = 'LifeOS';

mkdirSync(DIR, { recursive: true });

const TOP = [
  'dashboard','finance','tasks','nutrition','sport','more','invest',
  'health','settings','ai-chat','calendar','routines','routine-form',
  'subscriptions','subscription-form','notes','note-editor','documents',
  'document-form','sleep','sleep-form','shopping','water','goals',
  'goal-form','expenses-list','expense-form','income-form','transfer-form',
  'finance-analytics','task-form','projects','search','food-search',
  'body-weight','weekly-report','active-workout','barcode-scanner',
];

const SUBS = [
  { m: 'finance', ss: ['overview','expenses','incomes','accounts','credits','budgets','analytics','finance-tools'] },
  { m: 'sport', ss: ['overview','history','exercises','bodyWeight','progress','prList','measurements','photos','video'] },
  { m: 'invest', ss: ['overview','dividends','trades','networth','watchlist','tax','invest-tools'] },
  { m: 'settings', ss: ['profile','security','ai','data','notifications','analytics','about','appearance','error-log'] },
];

function buildAll() {
  const list = TOP.map(s => ({ label: s, nav: [s] }));
  for (const { m, ss } of SUBS) {
    for (const sub of ss) {
      list.push({ label: m + '--' + sub, nav: [m, { subScreen: sub }] });
    }
  }
  return list;
}

async function run() {
  const screens = buildAll();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('=== Full Screenshot Capture ===');
  console.log('Screens: ' + screens.length + '\n');

  // Setup
  const setup = await context.newPage();
  await setup.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await setup.waitForTimeout(1500);
  await setup.evaluate(async (dbName) => {
    const req = indexedDB.open(dbName);
    return new Promise(resolve => {
      req.onsuccess = () => {
        const db = req.result;
        if (!Array.from(db.objectStoreNames).includes('settings')) { db.close(); resolve(); return; }
        const tx = db.transaction('settings', 'readwrite');
        const s = tx.objectStore('settings');
        s.put({ key: 'has_completed_onboarding', value: true });
        s.put({ key: 'onboarding_complete', value: 'true' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      req.onerror = () => resolve();
    });
  }, DB_NAME);
  await setup.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await setup.waitForTimeout(2000);

  const page = setup; // reuse
  let okCount = 0;
  let errCount = 0;
  let blankCount = 0;

  for (const screen of screens) {
    try {
      await page.evaluate(({ s, d }) => window.__LIFEOS_NAV?.(s, d || undefined), {
        s: screen.nav[0], d: screen.nav[1] || null,
      });
      await page.waitForTimeout(1500);

      const text = (await page.locator('body').innerText()).trim();
      const isBlank = text.length <= 10;

      await page.screenshot({ path: resolve(DIR, screen.label + '.png'), fullPage: false });

      if (isBlank) {
        blankCount++;
        console.log('[BLANK] ' + screen.label);
      } else {
        okCount++;
        process.stdout.write('[OK] ' + screen.label + '\n');
      }
    } catch (err) {
      errCount++;
      console.log('[ERR]  ' + screen.label + ': ' + err.message.slice(0, 60));
    }
  }

  console.log('\n==========================================');
  console.log('  SCREENSHOT RESULTS');
  console.log('==========================================');
  console.log('  Total:  ' + screens.length);
  console.log('  OK:     ' + okCount);
  console.log('  BLANK:  ' + blankCount);
  console.log('  ERROR:  ' + errCount);
  console.log('  Saved to: tests/screens-all/');
  console.log('==========================================\n');

  await browser.close();
  process.exit(errCount > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(2); });
