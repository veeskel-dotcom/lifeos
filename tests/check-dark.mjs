/**
 * Dark Theme Test — checks all key screens in dark mode.
 * Run: node tests/check-dark.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, 'screens-dark');
const BASE = 'http://localhost:5199';

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SCREENS = [
  { name: 'dashboard', nav: ['dashboard'], shot: true },
  { name: 'finance', nav: ['finance'], shot: true },
  { name: 'tasks', nav: ['tasks'], shot: true },
  { name: 'nutrition', nav: ['nutrition'], shot: true },
  { name: 'sport', nav: ['sport'], shot: true },
  { name: 'more', nav: ['more'], shot: true },
  { name: 'invest', nav: ['invest'], shot: true },
  { name: 'health', nav: ['health'], shot: true },
  { name: 'settings', nav: ['settings'], shot: true },
  { name: 'ai-chat', nav: ['ai-chat'], shot: true },
  { name: 'calendar', nav: ['calendar'], shot: false },
  { name: 'routines', nav: ['routines'], shot: false },
  { name: 'notes', nav: ['notes'], shot: false },
  { name: 'sleep', nav: ['sleep'], shot: false },
  { name: 'shopping', nav: ['shopping'], shot: false },
  { name: 'documents', nav: ['documents'], shot: false },
  { name: 'goals', nav: ['goals'], shot: false },
  { name: 'search', nav: ['search'], shot: false },
  { name: 'water', nav: ['water'], shot: false },
  { name: 'projects', nav: ['projects'], shot: false },
  { name: 'expenses-list', nav: ['expenses-list'], shot: false },
  { name: 'finance-analytics', nav: ['finance-analytics'], shot: false },
  { name: 'finance-overview', nav: ['finance', { subScreen: 'overview' }], shot: false },
  { name: 'finance-budgets', nav: ['finance', { subScreen: 'budgets' }], shot: false },
  { name: 'finance-credits', nav: ['finance', { subScreen: 'credits' }], shot: false },
  { name: 'sport-overview', nav: ['sport', { subScreen: 'overview' }], shot: true },
  { name: 'sport-history', nav: ['sport', { subScreen: 'history' }], shot: false },
  { name: 'sport-exercises', nav: ['sport', { subScreen: 'exercises' }], shot: false },
  { name: 'sport-bodyWeight', nav: ['sport', { subScreen: 'bodyWeight' }], shot: false },
  { name: 'invest-networth', nav: ['invest', { subScreen: 'networth' }], shot: true },
  { name: 'invest-dividends', nav: ['invest', { subScreen: 'dividends' }], shot: false },
  { name: 'invest-trades', nav: ['invest', { subScreen: 'trades' }], shot: false },
  { name: 'settings-ai', nav: ['settings', { subScreen: 'ai' }], shot: true },
  { name: 'settings-appearance', nav: ['settings', { subScreen: 'appearance' }], shot: true },
  { name: 'settings-data', nav: ['settings', { subScreen: 'data' }], shot: false },
  { name: 'settings-security', nav: ['settings', { subScreen: 'security' }], shot: false },
  { name: 'settings-profile', nav: ['settings', { subScreen: 'profile' }], shot: false },
];

function filterNoise(errors) {
  return errors.filter(e =>
    !e.includes('ResizeObserver') && !e.includes('Failed to fetch') &&
    !e.includes('NetworkError') && !e.includes('Load failed') &&
    !e.includes('AbortError') && !e.includes('navigator.serviceWorker') &&
    !e.includes('Notification') && !e.includes('denied') &&
    !e.includes('QuotaExceeded') && !e.includes('storage') &&
    !e.includes('insecure')
  );
}

async function checkHardcodedColors(page) {
  return page.evaluate(() => {
    const issues = [];
    const LIGHT_BG_RE = /background(-color)?\s*:\s*(#fff|#ffffff|white|#F[2-9A-F]F[2-9A-F]F[2-9A-F])/i;
    const DARK_TEXT_RE = /(?<![a-z-])color\s*:\s*(#000|#000000|black)/i;
    let checked = 0;
    for (const el of document.querySelectorAll('*')) {
      if (checked > 3000) break;
      checked++;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const styleProp = el.getAttribute('style') || '';
      if (!styleProp) continue;
      const tag = el.tagName.toLowerCase();
      const cls = (el.className?.toString?.() || '').slice(0, 60);
      const text = (el.textContent || '').slice(0, 30).trim();
      if (LIGHT_BG_RE.test(styleProp) && rect.width > 30 && rect.height > 20) {
        issues.push({ type: 'light-bg', element: tag + (cls ? '.' + cls.split(' ')[0] : ''), value: styleProp.match(/background[^;]*/)?.[0] || '', text, size: Math.round(rect.width) + 'x' + Math.round(rect.height) });
      }
      if (DARK_TEXT_RE.test(styleProp) && rect.width > 20 && rect.height > 10) {
        const bg = style.backgroundColor;
        const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m && (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3 < 60) {
          issues.push({ type: 'dark-text', element: tag + (cls ? '.' + cls.split(' ')[0] : ''), value: styleProp.match(/color[^;]*/)?.[0] || '', bg, text });
        }
      }
    }
    return issues;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });

  console.log('=== LifeOS Dark Theme Test ===');
  console.log('Screens: ' + SCREENS.length + '\n');

  // Setup: set onboarding + theme in IndexedDB
  const setupPage = await context.newPage();
  await setupPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await setupPage.waitForTimeout(2000);

  const dbOk = await setupPage.evaluate(async () => {
    try {
      const req = indexedDB.open('LifeOS');
      return new Promise(resolve => {
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);
          if (!stores.includes('settings')) {
            resolve({ ok: false, reason: 'no settings store', stores });
            return;
          }
          const tx = db.transaction('settings', 'readwrite');
          const s = tx.objectStore('settings');
          s.put({ key: 'has_completed_onboarding', value: true });
          s.put({ key: 'onboarding_complete', value: 'true' });
          s.put({ key: 'theme', value: 'dark' });
          tx.oncomplete = () => resolve({ ok: true });
          tx.onerror = () => resolve({ ok: false, reason: 'tx error' });
        };
        req.onerror = () => resolve({ ok: false, reason: 'open error' });
      });
    } catch (e) { return { ok: false, reason: e.message }; }
  });

  console.log('[setup] DB: ' + JSON.stringify(dbOk));
  await setupPage.close();

  // Verify dark theme
  const verifyPage = await context.newPage();
  await verifyPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await verifyPage.waitForTimeout(2500);

  const themeCheck = await verifyPage.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    return { bodyBg: bg, htmlBg: htmlBg, systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches };
  });

  console.log('[verify] Theme: ' + JSON.stringify(themeCheck));

  const isDarkApplied =
    themeCheck.bodyBg.includes('rgb(0, 0, 0)') ||
    themeCheck.htmlBg.includes('rgb(0, 0, 0)') ||
    themeCheck.bodyBg.includes('rgb(28, 28, 30)');

  if (!isDarkApplied) {
    console.log('\n[BUG] Dark theme NOT applied. Body bg: ' + themeCheck.bodyBg);
  } else {
    console.log('[OK] Dark theme active (bg: ' + themeCheck.bodyBg + ')\n');
  }
  await verifyPage.close();

  // Test each screen
  const results = [];
  const allColorIssues = [];

  for (const item of SCREENS) {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

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

      await page.waitForTimeout(2000);

      const critical = filterNoise(pageErrors);
      const bodyText = await page.locator('body').innerText();
      const isBlank = bodyText.trim().length <= 5;
      const colorIssues = await checkHardcodedColors(page);
      if (colorIssues.length > 0) allColorIssues.push({ screen: item.name, issues: colorIssues });

      if (item.shot) {
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, item.name + '.png'), fullPage: false });
      }

      if (critical.length > 0) {
        results.push({ name: item.name, status: 'CRASH', errors: critical });
      } else if (isBlank) {
        results.push({ name: item.name, status: 'BLANK', errors: ['Blank page'] });
      } else if (colorIssues.length > 0) {
        results.push({ name: item.name, status: 'WARN', colorIssues: colorIssues.length });
      } else {
        results.push({ name: item.name, status: 'OK' });
      }
    } catch (err) {
      results.push({ name: item.name, status: 'CRASH', errors: [err.message.slice(0, 200)] });
    }

    await page.close();

    const r = results[results.length - 1];
    const icon = r.status === 'OK' ? '[OK]' : r.status === 'WARN' ? '[WARN]' : r.status === 'SKIP' ? '[SKIP]' : r.status === 'BLANK' ? '[BLANK]' : '[CRASH]';
    let detail = '';
    if (r.status === 'CRASH') detail = ' -- ' + (r.errors?.[0] || '').slice(0, 80);
    if (r.status === 'WARN') detail = ' -- ' + r.colorIssues + ' color issues';
    console.log(icon + ' ' + r.name + detail);
  }

  // Report
  const ok = results.filter(r => r.status === 'OK').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const crash = results.filter(r => r.status === 'CRASH').length;
  const blank = results.filter(r => r.status === 'BLANK').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log('\n==========================================');
  console.log('  DARK THEME TEST RESULTS');
  console.log('==========================================');
  console.log('  Total: ' + results.length);
  console.log('  OK:    ' + ok);
  console.log('  WARN:  ' + warn + ' (hardcoded colors)');
  console.log('  CRASH: ' + crash);
  console.log('  BLANK: ' + blank);
  console.log('  SKIP:  ' + skip);
  console.log('==========================================');

  if (crash > 0) {
    console.log('\n[CRASH] Screens that crashed:');
    for (const r of results.filter(r => r.status === 'CRASH')) {
      console.log('  ' + r.name + ':');
      for (const e of (r.errors || [])) console.log('    -> ' + e.slice(0, 150));
    }
  }

  if (blank > 0) {
    console.log('\n[BLANK] Blank screens:');
    for (const r of results.filter(r => r.status === 'BLANK')) console.log('  ' + r.name);
  }

  if (allColorIssues.length > 0) {
    console.log('\n[WARN] Hardcoded color issues:');
    for (const sc of allColorIssues) {
      console.log('  ' + sc.screen + ' (' + sc.issues.length + ' issues)');
      for (const issue of sc.issues.slice(0, 5)) {
        if (issue.type === 'light-bg') {
          console.log('    [light-bg] ' + issue.element + ' bg=' + issue.value + ' size=' + issue.size);
        } else {
          console.log('    [dark-text] ' + issue.element + ' color=' + issue.value + ' on bg=' + issue.bg);
        }
      }
      if (sc.issues.length > 5) console.log('    ... and ' + (sc.issues.length - 5) + ' more');
    }
  }

  const shots = SCREENS.filter(s => s.shot).length;
  console.log('\nScreenshots saved: ' + shots + ' files in tests/screens-dark/\n');

  await browser.close();
  process.exit(crash > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
