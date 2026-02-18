/**
 * LifeOS Console Error/Warning Scanner
 * Navigates to all 79 screens and captures console.error / console.warn.
 * Run: node tests/check-console.mjs
 */
import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:5199";

const NOISE_PATTERNS = [
  /ResizeObserver/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /Load failed/i,
  /AbortError/i,
  /serviceWorker/i,
  /Notification/i,
  /\bdenied\b/i,
  /QuotaExceeded/i,
  /\bstorage\b/i,
  /\binsecure\b/i,
  /favicon/i,
  /manifest/i,
  /workbox/i,
  /\bCORS\b/i,
  /openrouter/i,
  /fatsecret/i,
  /net::ERR/i,
];

function isNoise(text) {
  return NOISE_PATTERNS.some((re) => re.test(text));
}
const TOP_LEVEL = [
  "dashboard", "finance", "tasks", "nutrition", "sport", "more",
  "invest", "health", "settings", "ai-chat", "calendar", "routines",
  "routine-form", "subscriptions", "subscription-form", "notes",
  "note-editor", "documents", "document-form", "sleep", "sleep-form",
  "sleep-add", "shopping", "barcode-scanner", "water", "analytics",
  "notifications", "utilities", "body-weight", "goals", "goal-form",
  "expenses-list", "expense-form", "income-form", "transfer-form",
  "finance-analytics", "task-form", "projects", "event-form",
  "week-grid", "weekly-report", "search", "active-workout", "food-search",
];

const MODULES = [
  { parent: "finance", subScreens: ["overview","expenses","incomes","accounts","credits","budgets","analytics","finance-tools","utilities"] },
  { parent: "sport", subScreens: ["overview","history","exercises","bodyWeight","progress","prList","measurements","photos","video","aiTrainer","templateList"] },
  { parent: "invest", subScreens: ["dividends","trades","networth","watchlist","tax","invest-tools"] },
  { parent: "settings", subScreens: ["profile","security","ai","data","notifications","analytics","about","appearance","error-log"] },
];
async function main() {
  console.log("LifeOS Console Scanner starting..." + "\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const capturedMessages = [];
  let currentScreen = "__loading__";

  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (isNoise(text)) return;
    capturedMessages.push({ screen: currentScreen, type, text });
  });

  page.on("pageerror", (err) => {
    const text = err.message || String(err);
    if (isNoise(text)) return;
    capturedMessages.push({ screen: currentScreen, type: "error", text: "[PageError] " + text });
  });

  console.log("  Loading app at " + BASE_URL + " ...");
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });

  console.log("  Skipping onboarding (IndexedDB)...");
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("lifeos");
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("settings")) { db.close(); resolve("no-store"); return; }
        const tx = db.transaction("settings", "readwrite");
        const store = tx.objectStore("settings");
        store.put({ key: "onboarding_complete", value: true });
        tx.oncomplete = () => { db.close(); resolve("done"); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  });

  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  const hasNav = await page.evaluate(() => typeof window.__LIFEOS_NAV === "function");
  if (!hasNav) {
    console.error("  ERROR: __LIFEOS_NAV not found! Retrying...");
    await page.reload({ waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const retry = await page.evaluate(() => typeof window.__LIFEOS_NAV === "function");
    if (!retry) { console.error("  FATAL: __LIFEOS_NAV unavailable. Aborting."); await browser.close(); process.exit(1); }
  }
  console.log("  __LIFEOS_NAV is available" + "\n");
  async function navigateTo(screen, data) {
    currentScreen = data ? screen + ":{subScreen:" + JSON.stringify(data.subScreen) + "}" : screen;
    try {
      await page.evaluate(({ s, d }) => window.__LIFEOS_NAV(s, d), { s: screen, d: data || null });
    } catch (e) {
      capturedMessages.push({ screen: currentScreen, type: "error", text: "[NavError] " + e.message });
    }
    await page.waitForTimeout(800);
  }

  function getStatus(errors, warnings) {
    if (errors.length > 0) return "X (" + errors.length + " error(s), " + warnings.length + " warning(s))";
    if (warnings.length > 0) return "! (" + warnings.length + " warning(s))";
    return "OK";
  }

  console.log("--- TOP-LEVEL SCREENS ---");
  let screenIndex = 0;
  const totalScreens = TOP_LEVEL.length + MODULES.reduce((sum, m) => sum + m.subScreens.length, 0);

  for (const screen of TOP_LEVEL) {
    screenIndex++;
    const before = capturedMessages.length;
    await navigateTo(screen);
    const after = capturedMessages.length;
    const screenMsgs = capturedMessages.slice(before, after);
    const errors = screenMsgs.filter((m) => m.type === "error");
    const warnings = screenMsgs.filter((m) => m.type === "warning");
    console.log("  [" + screenIndex + "/" + totalScreens + "] " + screen + " ... " + getStatus(errors, warnings));
  }
  for (const mod of MODULES) {
    console.log("\n--- " + mod.parent.toUpperCase() + " MODULE ---");
    for (const sub of mod.subScreens) {
      screenIndex++;
      const label = mod.parent + ":{subScreen:" + JSON.stringify(sub) + "}";
      const before = capturedMessages.length;
      await navigateTo(mod.parent, { subScreen: sub });
      const after = capturedMessages.length;
      const screenMsgs = capturedMessages.slice(before, after);
      const errors = screenMsgs.filter((m) => m.type === "error");
      const warnings = screenMsgs.filter((m) => m.type === "warning");
      console.log("  [" + screenIndex + "/" + totalScreens + "] " + label + " ... " + getStatus(errors, warnings));
    }
  }
  console.log("\n\n" + "=".repeat(70));
  console.log("  FULL REPORT -- All captured errors and warnings");
  console.log("=".repeat(70));

  const grouped = {};
  for (const msg of capturedMessages) {
    if (!grouped[msg.screen]) grouped[msg.screen] = [];
    grouped[msg.screen].push(msg);
  }

  const screensWithErrors = [];
  const screensWithWarnings = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [screen, msgs] of Object.entries(grouped)) {
    const errors = msgs.filter((m) => m.type === "error");
    const warnings = msgs.filter((m) => m.type === "warning");
    totalErrors += errors.length;
    totalWarnings += warnings.length;
    if (errors.length > 0) screensWithErrors.push(screen);
    if (warnings.length > 0 && errors.length === 0) screensWithWarnings.push(screen);
    console.log("\n-- " + screen);
    for (const m of msgs) {
      const icon = m.type === "error" ? "[ERR]" : "[WARN]";
      const text = m.text.length > 300 ? m.text.slice(0, 300) + "..." : m.text;
      console.log("   " + icon + " " + text);
    }
  }
  console.log("\n" + "=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));
  console.log("  Total screens scanned: " + totalScreens);
  console.log("  Total errors:   " + totalErrors);
  console.log("  Total warnings: " + totalWarnings);
  console.log("  Screens with errors (" + screensWithErrors.length + "):   " + (screensWithErrors.join(", ") || "(none)"));
  console.log("  Screens with warnings only (" + screensWithWarnings.length + "): " + (screensWithWarnings.join(", ") || "(none)"));
  console.log("  Clean screens: " + (totalScreens - screensWithErrors.length - screensWithWarnings.length));
  console.log("=".repeat(70));

  if (capturedMessages.length === 0) {
    console.log("\nNo console errors or warnings found across all screens!");
  }

  await browser.close();
  console.log("\nDone.");
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
