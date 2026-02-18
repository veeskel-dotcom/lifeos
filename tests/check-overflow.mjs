/**
 * LifeOS Layout Overflow Checker
 * Checks all screens for horizontal overflow (iOS PWA bug).
 * Usage: node tests/check-overflow.mjs
 */
import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5199';
const VIEWPORT = { width: 390, height: 844 };

const TOP_SCREENS = [
  'dashboard','finance','tasks','nutrition','sport','more','invest',
  'health','settings','ai-chat','calendar','routines','routine-form',
  'subscriptions','subscription-form','notes','note-editor','documents',
  'document-form','sleep','sleep-form','shopping',
  'water','goals','goal-form','expenses-list','expense-form',
  'income-form','transfer-form','finance-analytics','task-form','projects',
  'search','food-search','body-weight',
];

const FINANCE_SUBS = ['overview','expenses','incomes','accounts','credits','budgets','analytics','finance-tools'];
const SPORT_SUBS = ['overview','history','exercises','bodyWeight','progress','prList','measurements','photos','video'];
const INVEST_SUBS = ['dividends','trades','networth','watchlist','tax','invest-tools'];
const SETTINGS_SUBS = ['profile','security','ai','data','notifications','analytics','about','appearance','error-log'];

function buildScreenList() {
  const screens = [];
  for (const s of TOP_SCREENS) screens.push({ label: s, nav: [s] });
  for (const sub of FINANCE_SUBS) screens.push({ label: 'finance/' + sub, nav: ['finance', { subScreen: sub }] });
  for (const sub of SPORT_SUBS) screens.push({ label: 'sport/' + sub, nav: ['sport', { subScreen: sub }] });
  for (const sub of INVEST_SUBS) screens.push({ label: 'invest/' + sub, nav: ['invest', { subScreen: sub }] });
  for (const sub of SETTINGS_SUBS) screens.push({ label: 'settings/' + sub, nav: ['settings', { subScreen: sub }] });
  return screens;
}

async function skipOnboarding(page) {
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('lifeos');
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) {
          db.close();
          const v = db.version + 1;
          const req2 = indexedDB.open('lifeos', v);
          req2.onupgradeneeded = () => {
            if (!req2.result.objectStoreNames.contains('settings'))
              req2.result.createObjectStore('settings', { keyPath: 'key' });
          };
          req2.onsuccess = () => {
            const db2 = req2.result;
            const tx = db2.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ key: 'onboarding_complete', value: 'true' });
            tx.oncomplete = () => { db2.close(); resolve(); };
            tx.onerror = () => { db2.close(); reject(tx.error); };
          };
          req2.onerror = () => reject(req2.error);
          return;
        }
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key: 'onboarding_complete', value: 'true' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  });
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const docScrollW = document.documentElement.scrollWidth;
    const docClientW = document.documentElement.clientWidth;
    const overflowing = [];
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 120) : '',
          id: el.id || '',
          overflowPx: Math.round(rect.right - vw),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    const seen = new Map();
    for (const item of overflowing) {
      const key = item.tag + '.' + item.className;
      const existing = seen.get(key);
      if (!existing || item.overflowPx > existing.overflowPx) seen.set(key, item);
    }
    return {
      docOverflow, docScrollW, docClientW, viewportWidth: vw,
      elements: Array.from(seen.values()).sort((a, b) => b.overflowPx - a.overflowPx).slice(0, 15),
    };
  });
}

async function main() {
  const screens = buildScreenList();
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('  LifeOS Layout Overflow Checker');
  console.log('  Viewport: ' + VIEWPORT.width + 'x' + VIEWPORT.height);
  console.log('  Screens: ' + screens.length);
  console.log(sep + '\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});

  console.log('[SETUP] Loading app...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  await skipOnboarding(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const hasNav = await page.evaluate(() => typeof window.__LIFEOS_NAV === 'function');
  if (!hasNav) {
    console.error('[ERROR] __LIFEOS_NAV not found');
    await browser.close();
    process.exit(1);
  }
  console.log('[SETUP] Ready.\n');

  const results = [];
  let passCount = 0, failCount = 0, errorCount = 0;

  for (const screen of screens) {
    try {
      await page.evaluate(({ s, d }) => window.__LIFEOS_NAV(s, d || undefined), {
        s: screen.nav[0],
        d: screen.nav[1] || null,
      });
      await page.waitForTimeout(1500);

      const result = await checkOverflow(page);
      const hasIssue = result.docOverflow || result.elements.length > 0;

      results.push({ screen: screen.label, ...result, error: null });

      if (hasIssue) {
        failCount++;
        const overflow = result.docOverflow ? 'doc +' + (result.docScrollW - result.docClientW) + 'px' : '';
        const els = result.elements.length > 0 ? result.elements.length + ' el(s)' : '';
        console.log('[FAIL] ' + screen.label + ': ' + [overflow, els].filter(Boolean).join(', '));
        for (const el of result.elements.slice(0, 3)) {
          console.log('       ' + el.tag + (el.className ? '.' + el.className.split(' ')[0] : '') + ' overflow=' + el.overflowPx + 'px w=' + el.width);
        }
      } else {
        passCount++;
        process.stdout.write('[PASS] ' + screen.label + '\n');
      }
    } catch (err) {
      errorCount++;
      results.push({ screen: screen.label, error: err.message });
      console.log('[ERR]  ' + screen.label + ': ' + err.message.slice(0, 80));
    }
  }

  await browser.close();

  console.log('\n' + sep);
  console.log('  SUMMARY');
  console.log(sep);
  console.log('  Total:  ' + screens.length);
  console.log('  PASS:   ' + passCount);
  console.log('  FAIL:   ' + failCount);
  console.log('  ERROR:  ' + errorCount);

  if (failCount > 0) {
    console.log('\n  --- Screens with overflow ---');
    for (const f of results.filter(r => !r.error && (r.docOverflow || (r.elements && r.elements.length > 0)))) {
      console.log('    - ' + f.screen);
    }
  }

  if (failCount === 0 && errorCount === 0) {
    console.log('\n  All screens passed! No overflow detected.');
  }

  console.log('\n' + sep + '\n');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
