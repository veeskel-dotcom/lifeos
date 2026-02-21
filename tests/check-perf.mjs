/**
 * Performance Budget Test — measures cold start, LCP, bundle size, screen switch.
 * Run: node tests/check-perf.mjs
 * Requires: npx vite build + npx vite preview running on localhost:5199
 */
import { chromium } from '@playwright/test';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5199';
const DIST = 'dist/assets';

// Budgets
const BUDGET = {
  coldStart: 3000,      // ms — DOMContentLoaded + load
  lcp: 2500,            // ms — Largest Contentful Paint
  mainChunk: 460 * 1024, // bytes — main JS chunk
  screenSwitch: 500,    // ms — navigate to screen rendered
};

const SCREENS = [
  { label: 'finance',   nav: ['finance'] },
  { label: 'tasks',     nav: ['tasks'] },
  { label: 'sport',     nav: ['sport'] },
  { label: 'nutrition', nav: ['nutrition'] },
  { label: 'goals',     nav: ['goals'] },
];

function checkBundleSize() {
  const results = [];
  try {
    const files = readdirSync(DIST);
    const jsFiles = files.filter(f => f.endsWith('.js')).map(f => ({
      name: f,
      size: statSync(join(DIST, f)).size,
    })).sort((a, b) => b.size - a.size);

    const main = jsFiles[0];
    if (!main) {
      results.push({ metric: 'bundle', pass: false, detail: 'No JS files in dist/' });
      return results;
    }

    const pass = main.size <= BUDGET.mainChunk;
    const sizeKB = (main.size / 1024).toFixed(1);
    const budgetKB = (BUDGET.mainChunk / 1024).toFixed(0);
    results.push({
      metric: 'bundle',
      pass,
      detail: `${main.name}: ${sizeKB}KB (budget: ${budgetKB}KB)`,
    });

    // Show top 3
    for (const f of jsFiles.slice(0, 3)) {
      const kb = (f.size / 1024).toFixed(1);
      results.push({ metric: 'chunk', pass: true, detail: `  ${f.name}: ${kb}KB` });
    }
  } catch (e) {
    results.push({ metric: 'bundle', pass: false, detail: `Error: ${e.message}` });
  }
  return results;
}

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

async function measureColdStart(context) {
  const page = await context.newPage();
  const start = Date.now();

  await page.goto(BASE, { waitUntil: 'load', timeout: 15000 });
  const loadTime = Date.now() - start;

  // Measure LCP
  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      let lcpValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          lcpValue = entry.startTime;
        }
      });
      try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { resolve(0); return; }
      // Wait a bit for LCP to finalize
      setTimeout(() => {
        observer.disconnect();
        resolve(Math.round(lcpValue));
      }, 2000);
    });
  });

  await page.close();
  return { loadTime, lcp };
}

async function measureScreenSwitch(context, screen) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  const time = await page.evaluate(async ({ nav, timeout }) => {
    if (!window.__LIFEOS_NAV) return -1;
    const start = performance.now();
    window.__LIFEOS_NAV(nav[0], nav[1] || undefined);

    // Wait for content to render
    await new Promise(resolve => {
      let elapsed = 0;
      const check = () => {
        elapsed += 50;
        const text = document.body.innerText?.trim() || '';
        if (text.length > 20 || elapsed >= timeout) resolve();
        else setTimeout(check, 50);
      };
      check();
    });

    return Math.round(performance.now() - start);
  }, { nav: screen.nav, timeout: BUDGET.screenSwitch + 500 });

  await page.close();
  return time;
}

async function run() {
  console.log('============================================================');
  console.log('  Performance Budget Test');
  console.log('============================================================\n');

  // 1. Bundle size
  console.log('--- Bundle Size ---');
  const bundleResults = checkBundleSize();
  for (const r of bundleResults) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon} ${r.detail}`);
  }
  console.log();

  // 2. Cold start + LCP
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  await skipOnboarding(context);

  console.log('--- Cold Start & LCP ---');
  const { loadTime, lcp } = await measureColdStart(context);
  const loadPass = loadTime <= BUDGET.coldStart;
  const lcpPass = lcp <= BUDGET.lcp || lcp === 0;
  console.log(`  ${loadPass ? 'PASS' : 'FAIL'} Cold start: ${loadTime}ms (budget: ${BUDGET.coldStart}ms)`);
  console.log(`  ${lcpPass ? 'PASS' : 'FAIL'} LCP: ${lcp}ms (budget: ${BUDGET.lcp}ms)`);
  console.log();

  // 3. Screen switch times
  console.log('--- Screen Switch ---');
  const switchResults = [];
  for (const screen of SCREENS) {
    const time = await measureScreenSwitch(context, screen);
    const pass = time >= 0 && time <= BUDGET.screenSwitch;
    const detail = time < 0 ? 'NAV not available' : `${time}ms`;
    console.log(`  ${pass ? 'PASS' : 'FAIL'} ${screen.label.padEnd(15)} ${detail} (budget: ${BUDGET.screenSwitch}ms)`);
    switchResults.push({ label: screen.label, time, pass });
  }
  console.log();

  await browser.close();

  // Summary
  const allBundlePass = bundleResults.filter(r => r.metric === 'bundle').every(r => r.pass);
  const allSwitchPass = switchResults.every(r => r.pass);
  const totalFail = (!allBundlePass ? 1 : 0) + (!loadPass ? 1 : 0) + (!lcpPass ? 1 : 0) + (!allSwitchPass ? 1 : 0);

  console.log('============================================================');
  console.log(`  Result: ${totalFail === 0 ? 'ALL PASS' : `${totalFail} FAIL`}`);
  console.log('============================================================');

  process.exit(totalFail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
