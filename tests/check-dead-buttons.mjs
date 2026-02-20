/**
 * Dead Button Detector — finds clickable elements without click handlers.
 *
 * Level 1 (default): Static scan — checks React fiber/props for onClick.
 * Level 2 (--verify): Clicks dead candidates, confirms nothing happens.
 * Full (--full): Level 2 on ALL buttons (slow, for pre-release).
 *
 * Run: node tests/check-dead-buttons.mjs [--verify] [--full]
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';
const VERIFY = process.argv.includes('--verify');
const FULL = process.argv.includes('--full');

// ── Screens ──

const TOP = [
  'dashboard', 'finance', 'tasks', 'nutrition', 'sport', 'more',
  'invest', 'health', 'settings',
  'notes', 'documents', 'sleep', 'shopping', 'water',
  'goals', 'expenses-list', 'subscriptions', 'routines',
  'body-weight', 'search', 'projects', 'calendar',
];

const MODULE_SUBS = [
  { screen: 'finance', subs: ['overview', 'expenses', 'incomes', 'accounts', 'credits', 'budgets', 'finance-tools'] },
  { screen: 'sport', subs: ['overview', 'history', 'exercises', 'bodyWeight', 'measurements', 'templateList'] },
  { screen: 'invest', subs: ['dividends', 'trades', 'networth', 'watchlist', 'tax', 'invest-tools'] },
  { screen: 'settings', subs: ['profile', 'security', 'ai', 'data', 'appearance', 'notifications', 'about'] },
];

function buildScreens() {
  const list = TOP.map(s => ({ label: s, nav: [s] }));
  for (const m of MODULE_SUBS) {
    for (const sub of m.subs) {
      list.push({ label: `${m.screen}/${sub}`, nav: [m.screen, { subScreen: sub }] });
    }
  }
  return list;
}

// ── Setup ──

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

async function navigateTo(page, screen, data) {
  const ok = await page.evaluate(({ screen, data }) => {
    if (!window.__LIFEOS_NAV) return false;
    window.__LIFEOS_NAV(screen, data || undefined);
    return true;
  }, { screen, data: data || null });
  if (ok) await page.waitForTimeout(1500);
  return ok;
}

// ── Level 1: Static Scan ──

async function findDeadButtons(page) {
  return page.evaluate(() => {
    const dead = [];
    const allClickables = [];

    // Targeted selectors
    const candidates = new Set();
    for (const el of document.querySelectorAll('.cursor-pointer')) candidates.add(el);
    for (const el of document.querySelectorAll('button:not([disabled])')) candidates.add(el);
    for (const el of document.querySelectorAll('[role="button"]')) candidates.add(el);
    for (const el of document.querySelectorAll('[style*="cursor"]')) candidates.add(el);

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.top > window.innerHeight + 100 || rect.bottom < 0) continue;

      const text = (el.textContent || '').trim().slice(0, 60).replace(/\n/g, ' ');
      const info = {
        tag: el.tagName.toLowerCase(),
        text,
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      };

      let hasHandler = false;

      // 1. Native clickable tags
      if (el.tagName === 'A' && el.href) hasHandler = true;
      if (el.tagName === 'LABEL' && el.htmlFor) hasHandler = true;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) hasHandler = true;

      // 1b. Submit buttons inside forms (action via form onSubmit, not button onClick)
      if (el.tagName === 'BUTTON' && el.type === 'submit' && el.closest('form')) hasHandler = true;

      // 2. Check React props on element + DOM ancestors (up to 5 levels)
      if (!hasHandler) {
        let node = el;
        for (let depth = 0; depth < 5 && node && node !== document.body; depth++) {
          for (const key of Object.keys(node)) {
            if (key.startsWith('__reactProps')) {
              if (typeof node[key]?.onClick === 'function') { hasHandler = true; break; }
            }
            if (key.startsWith('__reactFiber')) {
              let fiber = node[key];
              for (let f = 0; f < 3 && fiber; f++) {
                if (typeof fiber.memoizedProps?.onClick === 'function') { hasHandler = true; break; }
                fiber = fiber.return;
              }
            }
            if (hasHandler) break;
          }
          if (hasHandler) break;
          node = node.parentElement;
        }
      }

      // 3. Check children for handlers (wrapper with cursor-pointer over clickable child)
      if (!hasHandler) {
        if (el.querySelector('button, [role="button"], a[href]')) {
          hasHandler = true;
        }
        if (!hasHandler) {
          for (const child of el.querySelectorAll('*')) {
            for (const key of Object.keys(child)) {
              if (key.startsWith('__reactProps') && typeof child[key]?.onClick === 'function') {
                hasHandler = true;
                break;
              }
            }
            if (hasHandler) break;
          }
        }
      }

      allClickables.push(info);
      if (!hasHandler) dead.push(info);
    }

    return { dead, totalClickables: allClickables.length, allClickables };
  });
}

// ── Level 2: Click Verify ──

async function verifyButtons(page, buttons, screen) {
  const confirmed = [];
  const cap = Math.min(buttons.length, 80);

  for (let i = 0; i < cap; i++) {
    const btn = buttons[i];

    // Re-navigate to clean state
    await page.evaluate(({ s, d }) => window.__LIFEOS_NAV?.(s, d), {
      s: screen.nav[0], d: screen.nav[1] || null,
    });
    await page.waitForTimeout(800);

    // Snapshot before
    const before = await page.evaluate(() => ({
      toasts: document.querySelectorAll('[data-testid="toast-stack"] > *').length,
      textLen: document.body.innerText.length,
      histLen: window.history.length,
    }));

    // Click
    try {
      await page.mouse.click(btn.x, btn.y);
    } catch { continue; }
    await page.waitForTimeout(1000);

    // Snapshot after
    const after = await page.evaluate(() => ({
      toasts: document.querySelectorAll('[data-testid="toast-stack"] > *').length,
      textLen: document.body.innerText.length,
      histLen: window.history.length,
    }));

    const toastAppeared = after.toasts > before.toasts;
    const textChanged = Math.abs(after.textLen - before.textLen) > Math.max(before.textLen * 0.03, 20);
    const navigated = after.histLen > before.histLen;

    if (!toastAppeared && !textChanged && !navigated) {
      confirmed.push(btn);
    }
  }

  return confirmed;
}

// ── Main ──

async function run() {
  const screens = buildScreens();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const mode = FULL ? 'FULL (all buttons)' : VERIFY ? 'VERIFY (dead candidates)' : 'STATIC SCAN';
  console.log('============================================================');
  console.log(`  Dead Button Detector — ${mode}`);
  console.log(`  Screens: ${screens.length}`);
  console.log('============================================================\n');

  await skipOnboarding(context);

  const report = [];
  let totalDead = 0;

  for (const screen of screens) {
    const page = await context.newPage();

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      const navOk = await navigateTo(page, screen.nav[0], screen.nav[1]);
      if (!navOk) {
        console.log(`  ⏭ ${screen.label} (no __LIFEOS_NAV)`);
        report.push({ label: screen.label, total: 0, dead: [], skipped: true });
        await page.close();
        continue;
      }

      // Scroll to load lazy content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Level 1: Static scan
      const { dead, totalClickables, allClickables } = await findDeadButtons(page);

      let confirmedDead = dead;

      // Level 2: Verify
      if (VERIFY && dead.length > 0) {
        confirmedDead = await verifyButtons(page, dead, screen);
      }

      // --full: verify ALL buttons
      if (FULL) {
        confirmedDead = await verifyButtons(page, allClickables, screen);
      }

      totalDead += confirmedDead.length;
      report.push({ label: screen.label, total: totalClickables, dead: confirmedDead, skipped: false });

      const icon = confirmedDead.length > 0 ? '❌' : '✅';
      console.log(`  ${icon} ${screen.label.padEnd(25)} ${totalClickables} clickables, ${confirmedDead.length} dead`);

      if (confirmedDead.length > 0) {
        for (const d of confirmedDead) {
          console.log(`     └─ "${d.text.slice(0, 40)}" <${d.tag}> at (${d.x},${d.y})`);
        }
      }

    } catch (err) {
      console.log(`  ⚠ ${screen.label}: ${err.message.slice(0, 80)}`);
      report.push({ label: screen.label, total: 0, dead: [], skipped: false, error: err.message });
    }

    await page.close();
  }

  // ── Final Report ──
  console.log('\n============================================================');
  console.log('  FINAL REPORT');
  console.log('============================================================');

  const scanned = report.filter(r => !r.skipped).length;
  const withDead = report.filter(r => r.dead.length > 0);

  console.log(`  Screens scanned: ${scanned}`);
  console.log(`  Total dead buttons: ${totalDead}`);

  if (withDead.length > 0) {
    console.log('\n  DEAD BUTTONS:');
    for (const r of withDead) {
      for (const d of r.dead) {
        console.log(`    [${r.label}] "${d.text.slice(0, 40)}" <${d.tag}> at (${d.x},${d.y}) .${d.cls.split(' ').slice(0, 3).join('.')}`);
      }
    }
  } else {
    console.log('\n  No dead buttons found!');
  }

  console.log('\n============================================================\n');
  await browser.close();
  process.exit(totalDead > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
