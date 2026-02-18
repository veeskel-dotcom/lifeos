/**
 * logger.js — Подробное логирование для мобильной отладки.
 * Пишет в IndexedDB error_log: навигацию, тапы, ошибки, API, DB операции.
 * Ошибки и предупреждения автоматически отправляются на /api/proxy/log (Vercel Runtime Logs).
 * Макс 2000 записей. Экспорт JSON для анализа.
 */

const MAX_ENTRIES = 2000;
const REMOTE_FLUSH_MS = 3000;   // отправляем батч каждые 3 сек
const REMOTE_MAX_BATCH = 10;    // макс 10 записей за раз

let initialized = false;
let sessionId = null;
let lastScreen = null;
let appStartTs = null;

// In-memory buffer for when DB isn't ready yet
const earlyBuffer = [];
let dbReady = false;

// ═══ Remote error reporting ═══
const remoteQueue = [];
let remoteTimer = null;

function scheduleRemoteFlush() {
  if (remoteTimer) return;
  remoteTimer = setTimeout(flushRemote, REMOTE_FLUSH_MS);
}

async function flushRemote() {
  remoteTimer = null;
  if (remoteQueue.length === 0) return;
  const batch = remoteQueue.splice(0, REMOTE_MAX_BATCH);
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const payload = batch.map(e => ({ ...e, ua }));
    await fetch('/api/proxy/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: payload }),
    });
  } catch {
    // network down — silently drop, don't re-queue to avoid loops
  }
  // if more queued, schedule again
  if (remoteQueue.length > 0) scheduleRemoteFlush();
}

async function getDB() {
  const { default: db } = await import('../db/index');
  return db;
}

function getSessionId() {
  if (!sessionId) {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  return sessionId;
}

/** Core log writer */
export async function log(level, category, message, data = null) {
  const entry = {
    ts: Date.now(),
    level,       // 'error' | 'warn' | 'info' | 'nav' | 'action' | 'perf'
    cat: category, // 'error' | 'nav' | 'tap' | 'api' | 'db' | 'render' | 'lifecycle' | 'sw'
    msg: String(message).slice(0, 500),
    data: data ? (typeof data === 'string' ? data.slice(0, 3000) : JSON.stringify(data).slice(0, 3000)) : null,
    screen: lastScreen || '?',
    sid: getSessionId(),
    dt: appStartTs ? Date.now() - appStartTs : 0, // ms since app start
  };

  // Send errors & warnings to Vercel Runtime Logs
  if (level === 'error' || level === 'warn') {
    remoteQueue.push({ level, cat: category, msg: entry.msg, data: entry.data, screen: entry.screen, ts: entry.ts, sid: entry.sid });
    scheduleRemoteFlush();
  }

  if (!dbReady) {
    earlyBuffer.push(entry);
    if (earlyBuffer.length > 200) earlyBuffer.shift();
    return;
  }

  try {
    const db = await getDB();
    await db.error_log.add(entry);
  } catch {
    // DB broken — keep in memory
    earlyBuffer.push(entry);
  }
}

/** Flush early buffer once DB is ready */
export async function flushEarlyBuffer() {
  dbReady = true;
  if (earlyBuffer.length === 0) return;
  try {
    const db = await getDB();
    await db.error_log.bulkAdd(earlyBuffer);
    earlyBuffer.length = 0;
    // Prune
    const count = await db.error_log.count();
    if (count > MAX_ENTRIES) {
      const oldest = await db.error_log.orderBy('id').limit(count - MAX_ENTRIES).primaryKeys();
      await db.error_log.bulkDelete(oldest);
    }
  } catch {}
}

// ═══ Convenience loggers ═══

/** Navigation event: screen open, back, tab switch */
export function logNav(action, screen, extra = null) {
  lastScreen = screen || lastScreen;
  log('nav', 'nav', `${action}: ${screen}`, extra);
}

/** User tap/interaction */
export function logTap(element, screen = null) {
  log('action', 'tap', element, { screen: screen || lastScreen });
}

/** API call (start/end/error) */
export function logAPI(method, url, status, durationMs = null, error = null) {
  const lvl = error ? 'error' : 'info';
  log(lvl, 'api', `${method} ${url} → ${status}`, { durationMs, error: error?.slice?.(0, 500) });
}

/** DB operation */
export function logDB(op, table, detail = null) {
  log('info', 'db', `${op} ${table}`, detail);
}

/** Error with full stack */
export function logError(message, error = null) {
  const stack = error?.stack || error || '';
  log('error', 'error', message, typeof stack === 'string' ? stack : JSON.stringify(stack));
}

/** Warning */
export function logWarn(message, data = null) {
  log('warn', 'error', message, data);
}

/** Performance mark */
export function logPerf(label, durationMs) {
  log('perf', 'perf', `${label}: ${Math.round(durationMs)}ms`);
}

/** Lifecycle events (mount, unmount, visibility, etc.) */
export function logLifecycle(event, detail = null) {
  log('info', 'lifecycle', event, detail);
}

// ═══ Global handlers ═══

export function installGlobalHandlers() {
  if (initialized) return;
  initialized = true;
  appStartTs = Date.now();

  // Session start
  log('info', 'lifecycle', 'APP_START', {
    ua: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    online: navigator.onLine,
    lang: navigator.language,
  });

  // Uncaught exceptions
  window.addEventListener('error', (event) => {
    log('error', 'error', event.message || 'Uncaught error', [
      `File: ${event.filename || '?'}`,
      `Line: ${event.lineno}:${event.colno}`,
      `Stack: ${event.error?.stack || 'no stack'}`,
    ].join('\n'));
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason);
    log('error', 'error', `Promise rejected: ${msg}`, reason?.stack || '');
  });

  // Online/offline
  window.addEventListener('online', () => log('info', 'lifecycle', 'ONLINE'));
  window.addEventListener('offline', () => log('warn', 'lifecycle', 'OFFLINE'));

  // Visibility change (app background/foreground)
  document.addEventListener('visibilitychange', () => {
    log('info', 'lifecycle', document.hidden ? 'APP_HIDDEN' : 'APP_VISIBLE');
    // Flush pending errors to server when app goes to background
    if (document.hidden && remoteQueue.length > 0) {
      flushRemote();
    }
  });

  // Memory warnings (if available)
  if (navigator.deviceMemory) {
    log('info', 'lifecycle', `Device memory: ${navigator.deviceMemory}GB`);
  }

  // Touch error debugging — log rapid taps
  let tapCount = 0;
  let tapTimer = null;
  document.addEventListener('touchstart', () => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      if (tapCount >= 5) {
        log('warn', 'tap', `Rapid taps detected: ${tapCount}x in 1s`, { screen: lastScreen });
      }
      tapCount = 0;
    }, 1000);
  }, { passive: true });

  // Intercept console.error/warn to also persist them
  const origError = console.error;
  const origWarn = console.warn;

  console.error = function(...args) {
    origError.apply(console, args);
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack}`;
      if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
      return String(a);
    }).join(' ');
    log('error', 'error', msg.slice(0, 500), msg.length > 500 ? msg.slice(500, 3000) : null);
  };

  console.warn = function(...args) {
    origWarn.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    log('warn', 'error', msg.slice(0, 500));
  };
}

// ═══ Data access ═══

/** Get all logs (newest first) */
export async function getLogs(limit = 500) {
  try {
    // Include early buffer
    const db = await getDB();
    const dbLogs = await db.error_log.orderBy('id').reverse().limit(limit).toArray();
    if (earlyBuffer.length > 0) {
      return [...earlyBuffer.reverse(), ...dbLogs].slice(0, limit);
    }
    return dbLogs;
  } catch {
    return [...earlyBuffer].reverse();
  }
}

/** Clear all logs */
export async function clearLogs() {
  try {
    const db = await getDB();
    await db.error_log.clear();
    earlyBuffer.length = 0;
  } catch {}
}

/** Export full diagnostic report */
export async function exportLogs() {
  const logs = await getLogs(2000);
  const report = {
    exported_at: new Date().toISOString(),
    session_id: getSessionId(),
    device: {
      ua: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      online: navigator.onLine,
      memory: navigator.deviceMemory || 'unknown',
    },
    total_entries: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warn').length,
    logs,
  };
  return JSON.stringify(report, null, 2);
}
