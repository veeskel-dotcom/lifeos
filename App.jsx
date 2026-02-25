/**
 * App.jsx — Root component.
 * Wave 1 additions:
 *   P2 — Blur overlay on document.hidden
 *   A1.5 — expenses-by-category subScreen route
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { getThemeColors } from './theme/colors';
import { initializeDB, getSetting } from './db/helpers';
import { requestPersistence, isStandalone } from './security/persist';
import TabBar from './components/TabBar';
import DashboardScreen from './screens/DashboardScreen';
import QuickAddSheet from './components/QuickAddSheet';
import { useSwipeBack } from './hooks/useSwipeBack';
import { useRouter } from './hooks/useRouter';

/* ── Lazy-loaded modules (code splitting) ── */
const FinancesModule = lazy(() => import('./screens/finance'));
const TasksList = lazy(() => import('./screens/tasks').then(m => ({ default: m.TasksList })));
const TaskDetail = lazy(() => import('./screens/tasks').then(m => ({ default: m.TaskDetail })));
const TaskForm = lazy(() => import('./screens/tasks').then(m => ({ default: m.TaskForm })));
const ProjectsScreen = lazy(() => import('./screens/tasks').then(m => ({ default: m.ProjectsScreen })));
const CalendarScreen = lazy(() => import('./screens/calendar').then(m => ({ default: m.CalendarScreen })));
const EventForm = lazy(() => import('./screens/calendar').then(m => ({ default: m.EventForm })));
const WeekGrid = lazy(() => import('./screens/calendar').then(m => ({ default: m.WeekGrid })));
const NutritionScreen = lazy(() => import('./screens/nutrition/index'));
const SportModule = lazy(() => import('./screens/sport'));
const InvestModule = lazy(() => import('./screens/invest'));
const MoreScreen = lazy(() => import('./screens/more').then(m => ({ default: m.MoreScreen })));
const RoutinesList = lazy(() => import('./screens/more').then(m => ({ default: m.RoutinesList })));
const RoutineForm = lazy(() => import('./screens/more').then(m => ({ default: m.RoutineForm })));
const SubscriptionsList = lazy(() => import('./screens/more').then(m => ({ default: m.SubscriptionsList })));
const SubscriptionForm = lazy(() => import('./screens/more').then(m => ({ default: m.SubscriptionForm })));
const NotesList = lazy(() => import('./screens/more').then(m => ({ default: m.NotesList })));
const NoteEditor = lazy(() => import('./screens/more').then(m => ({ default: m.NoteEditor })));
const DocumentsList = lazy(() => import('./screens/more').then(m => ({ default: m.DocumentsList })));
const DocumentForm = lazy(() => import('./screens/more').then(m => ({ default: m.DocumentForm })));
const SleepScreen = lazy(() => import('./screens/more').then(m => ({ default: m.SleepScreen })));
const SleepForm = lazy(() => import('./screens/more').then(m => ({ default: m.SleepForm })));
const SettingsModule = lazy(() => import('./screens/settings'));
const OnboardingFlow = lazy(() => import('./screens/onboarding'));
const AIChatScreen = lazy(() => import('./screens/ai').then(m => ({ default: m.AIChatScreen })));
const WeeklyReport = lazy(() => import('./screens/ai/WeeklyReport'));
const GlobalSearch = lazy(() => import('./screens/search/GlobalSearch'));
const GoalsScreen = lazy(() => import('./screens/goals').then(m => ({ default: m.GoalsScreen })));
const GoalForm = lazy(() => import('./screens/goals').then(m => ({ default: m.GoalForm })));
const HealthHub = lazy(() => import('./screens/health/HealthHub'));
const ShoppingList = lazy(() => import('./screens/nutrition/ShoppingList'));
const BarcodeScanner = lazy(() => import('./screens/nutrition/BarcodeScanner'));
const UtilitiesScreen = lazy(() => import('./screens/finance/UtilitiesScreen'));
const AnalyticsScreen = lazy(() => import('./screens/settings/AnalyticsScreen'));
const NotificationsScreen = lazy(() => import('./screens/settings/NotificationsScreen'));
const BodyWeightLog = lazy(() => import('./screens/sport/BodyWeightLog'));
const WaterTracker = lazy(() => import('./screens/nutrition/WaterTracker'));
import NavHeader from './components/NavHeader';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/ToastProvider';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineBanner from './components/OfflineBanner';
import TransitionWrapper from './components/TransitionWrapper';
import { initServiceWorker } from './lib/registerSW';
import { checkNotificationTriggers } from './lib/notifications';
import { startPeriodicSync, stopPeriodicSync, startDeltaSync, stopDeltaSync } from './services/sync';
import { checkAndBackup } from './services/autoBackup';
import { subscribe as subscribeTriggers, emit as emitTrigger } from './services/triggerBus';
import { loadCurrency } from './utils/currency';
import { setupLockTimeout } from './security/lockScreen';
import { verifyPIN } from './security/pin';
import { authenticateBiometric, isBiometricRegistered } from './security/biometric';
import { installGlobalHandlers, logNav, logLifecycle, logPerf, flushEarlyBuffer } from './lib/logger';

/* ══════════════════════════════════════
   Root — theme watcher + providers
   ══════════════════════════════════════ */

export default function App() {
  const [theme, setTheme] = useState(() => getThemeColors('system'));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Only react to system changes when theme is 'system' (or not set)
      getSetting('theme').then(saved => {
        if (!saved || saved === 'system') setTheme(getThemeColors('system'));
      });
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync body/html background with theme to prevent white bars on edges
  useEffect(() => {
    document.documentElement.style.background = theme.bg;
    document.body.style.background = theme.bg;
  }, [theme]);

  return (
    <ToastProvider theme={theme}>
      <AppContent theme={theme} setTheme={setTheme} />
    </ToastProvider>
  );
}

/* ══════════════════════════════════════
   PIN Lock Screen
   ══════════════════════════════════════ */

const PIN_LENGTH = 4;
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['face', '0', 'del'],
];

function LockScreen({ theme, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleDigit = async (d) => {
    if (checking) return;
    const next = pin + d;
    if (next.length >= PIN_LENGTH) {
      setChecking(true);
      setPin(next);
      const valid = await verifyPIN(next);
      if (valid) {
        onUnlock();
      } else {
        setError('Неверный PIN');
        setShake(true);
        setTimeout(() => { setShake(false); setPin(''); setError(''); setChecking(false); }, 600);
      }
    } else {
      setPin(next);
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const handleFaceId = async () => {
    const ok = await isBiometricRegistered();
    if (!ok) return;
    const res = await authenticateBiometric();
    if (res) onUnlock();
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[9999]"
      style={{ background: theme.bg }}
    >
      <div className="text-4xl mb-6">🔐</div>
      <p className="text-base font-medium mb-6" style={{ color: theme.text }}>
        Введите PIN
      </p>

      {/* Dots */}
      <div
        className="flex gap-4 mb-8"
        style={{ animation: shake ? 'shake 0.4s ease-in-out' : 'none' }}
      >
        {Array.from({ length: Math.max(PIN_LENGTH, pin.length + 1, 4) }, (_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-200"
            style={{
              width: 14, height: 14,
              background: i < pin.length ? theme.text : 'transparent',
              border: `2px solid ${i < pin.length ? theme.text : theme.gray3}`,
            }}
          />
        )).slice(0, PIN_LENGTH)}
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: theme.red }}>{error}</p>
      )}

      {/* Numeric keypad */}
      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
        {KEYS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-6">
            {row.map((key) => {
              if (key === 'face') return (
                <button
                  key={key}
                  onClick={handleFaceId}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl active:opacity-60"
                  style={{ background: 'transparent' }}
                >
                  <span style={{ color: theme.gray2 }}>🔑</span>
                </button>
              );
              if (key === 'del') return (
                <button
                  key={key}
                  onClick={handleDelete}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg active:opacity-60"
                  style={{ background: 'transparent', color: theme.text }}
                >
                  ⌫
                </button>
              );
              return (
                <button
                  key={key}
                  onClick={() => handleDigit(key)}
                  className="w-16 h-16 rounded-full flex flex-col items-center justify-center active:scale-95 transition-transform"
                  style={{ background: theme.gray6, border: 'none' }}
                >
                  <span className="text-2xl font-light" style={{ color: theme.text }}>
                    {key}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════
   AppContent — main routing
   ══════════════════════════════════════ */

function AppContent({ theme, setTheme }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  /* M1.3: History API router */
  const router = useRouter();
  const subScreen = router.current;
  const lastSubRef = useRef(null);
  const exitTimerRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);

  // Keep last subScreen for exit animation + delay main content restoration
  if (subScreen) {
    lastSubRef.current = subScreen;
    if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
    if (isExiting) setIsExiting(false);
  } else if (lastSubRef.current && !isExiting) {
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setIsExiting(false);
      lastSubRef.current = null; // Clear so we don't loop
    }, 320);
  }
  const [moreScreen, setMoreScreen] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(null); // null = loading
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [locked, setLocked] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const { showToast } = useToast();

  /* ── P2 — Blur overlay on tab hidden ── */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setBlurred(true);
      else setTimeout(() => setBlurred(false), 300);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  /* ── Init ── */
  useEffect(() => {
    installGlobalHandlers(); // Catch errors for mobile debugging
    const initStart = Date.now();
    let unsub = null;
    (async () => {
      await initializeDB();
      await flushEarlyBuffer(); // DB ready — persist buffered logs
      logLifecycle('DB_READY');
      // T3: запуск data-миграций
      try {
        const { runDataMigrations } = await import('./db/migrations');
        const db = (await import('./db/index')).default;
        await runDataMigrations(db);
      } catch (e) { console.warn('[migrations]', e); }
      await loadCurrency();
      // A2: Restore saved theme preference
      const savedTheme = await getSetting('theme');
      if (savedTheme && savedTheme !== 'system') {
        setTheme(getThemeColors(savedTheme));
      }
      const done = await getSetting('has_completed_onboarding');
      logLifecycle('ONBOARDING_CHECK', { done: !!done });
      setOnboarded(!!done);
      const pinEnabled = await getSetting('pin_enabled');
      if (pinEnabled && isStandalone()) setLocked(true);
      await requestPersistence();
      initServiceWorker((hasUpdate) => {
        if (hasUpdate) setShowUpdatePrompt(true);
      });
      checkNotificationTriggers();
      checkAndBackup(); // M5.5: автобэкап
      emitTrigger('daily_check'); // Q1.8/Q1.9: dividends + subscriptions

      // T8: QuotaExceeded → toast
      document.addEventListener('lifeos:quota-exceeded', () => {
        showToast('⚠️ Хранилище почти заполнено! Создайте бэкап в Настройки → Данные');
      });

      // Network error → toast
      document.addEventListener('lifeos:network-error', (e) => {
        const msg = e.detail?.message || 'Ошибка сети';
        showToast(`⚠️ ${msg}`);
      });

      // Q1: Smart triggers — показывать уведомления
      unsub = subscribeTriggers((notifications) => {
        for (const n of notifications) {
          showToast(`${n.icon} ${n.title}: ${n.message}`);
        }
      });
      startPeriodicSync();
      // Дельта-синк: включить tracking + интервал если auto_server_sync
      import('./db/helpers').then(({ getSetting }) =>
        getSetting('auto_server_sync').then(v => {
          if (v) {
            import('./db/changeTracker').then(({ enableTracking }) => enableTracking());
            startDeltaSync();
          }
        })
      ).catch(() => {});
      logPerf('INIT_COMPLETE', Date.now() - initStart);

      // PWA Shortcuts: /?action=expense|task|workout
      const action = new URLSearchParams(window.location.search).get('action');
      if (action) {
        window.history.replaceState({}, '', '/');
        const actionMap = { expense: 'expense-form', task: 'task-form', workout: 'active-workout' };
        if (actionMap[action]) setTimeout(() => navigate(actionMap[action]), 100);
      }
    })();
    return () => { stopPeriodicSync(); stopDeltaSync(); unsub?.(); };
  }, []);

  /* ── Lock timeout ── */
  useEffect(() => {
    if (!locked) {
      const cleanup = setupLockTimeout(() => setLocked(true));
      return cleanup;
    }
  }, [locked]);

  /* ── Navigation helper (M1.3: backed by History API) ── */
  const appNavLockRef = useRef(false);
  const navigate = useCallback((screen, data) => {
    if (appNavLockRef.current) return;
    appNavLockRef.current = true;
    setTimeout(() => { appNavLockRef.current = false; }, 200);
    logNav('OPEN', screen, data ? Object.keys(data) : null);
    router.navigate(screen, data);
  }, [router]);

  // Expose for Playwright smoke tests (dev only)
  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__LIFEOS_NAV = navigate;

  const goBack = useCallback(() => {
    if (appNavLockRef.current) return;
    appNavLockRef.current = true;
    setTimeout(() => { appNavLockRef.current = false; }, 200);
    logNav('BACK', subScreen?.screen || 'unknown', { stackDepth: router.depth });
    router.goBack();
    setEditItem(null);
    setMoreScreen(null);
  }, [router, subScreen]);

  /* M1.2: Swipe-back gesture */
  const { overlayStyle } = useSwipeBack(() => {
    if (subScreen || moreScreen) goBack();
  });

  /* ── Onboarding ── */
  if (onboarded === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: theme.bg }}>
        <div className="text-4xl animate-pulse">⏳</div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <OnboardingFlow
        theme={theme}
        onComplete={async () => {
          await initializeDB();
          setOnboarded(true);
        }}
      />
    );
  }

  /* ── Lock screen ── */
  if (locked) {
    return <LockScreen theme={theme} onUnlock={() => setLocked(false)} />;
  }

  /* ── Sub-screen router ── */
  const renderSubScreen = () => {
    const sub = subScreen || lastSubRef.current;
    if (!sub) return null;
    const { screen } = sub;

    switch (screen) {
      /* Finance */
      case 'finance-analytics':
        return (
          <FinancesModule
            theme={theme}
            mode="analytics"
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      case 'expenses-list':
        return (
          <FinancesModule
            theme={theme}
            mode="expenses"
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      /* A1.5 — Drill-down from pie chart */
      case 'expenses-by-category':
        return (
          <FinancesModule
            theme={theme}
            mode="expenses"
            filterCategoryId={sub.categoryId}
            filterMonth={sub.month}
            filterCategoryName={sub.categoryName}
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      case 'expense-form':
        return (
          <FinancesModule
            theme={theme}
            mode="expense-form"
            editItem={sub.edit || editItem}
            onBack={goBack}
            onNavigate={navigate}
            onToast={showToast}
          />
        );
      case 'transfer-form':
        return (
          <FinancesModule
            theme={theme}
            mode="transfer"
            onBack={goBack}
            onToast={showToast}
          />
        );
      case 'income-form':
        return (
          <FinancesModule
            theme={theme}
            initialView="incomeForm"
            onBack={goBack}
            onToast={showToast}
          />
        );
      case 'food-search':
        return <NutritionScreen theme={theme} onBack={goBack} />;
      case 'active-workout':
        return <SportModule theme={theme} onBack={goBack} />;

      /* Tasks */
      case 'task-detail':
        return (
          <TaskDetail
            theme={theme}
            taskId={sub.taskId}
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      case 'task-form':
        return (
          <TaskForm
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Задача сохранена'); }}
          />
        );
      case 'projects':
        return (
          <ProjectsScreen
            theme={theme}
            onBack={goBack}
            onOpenTask={id => navigate('task-detail', { taskId: id })}
          />
        );

      /* Calendar */
      case 'eventForm':
      case 'event-form':
        return (
          <EventForm
            theme={theme}
            existing={sub.edit}
            defaultDate={sub.date}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Событие сохранено'); }}
          />
        );

      case 'week-grid':
        return <WeekGrid theme={theme} onBack={goBack} onNavigate={navigate} />;

      /* AI */
      case 'ai-chat':
        return <AIChatScreen theme={theme} onBack={goBack} onNavigate={navigate} />;
      case 'weekly-report':
        return <WeeklyReport theme={theme} onBack={goBack} />;

      /* More → sub-screens */
      case 'routines':
        return (
          <RoutinesList
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('routine-form')}
            onEdit={(r) => navigate('routine-form', { edit: r })}
          />
        );
      case 'routine-form':
        return (
          <RoutineForm
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Сохранено'); }}
          />
        );
      case 'subscriptions':
        return (
          <SubscriptionsList
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('subscription-form')}
            onEdit={(s) => navigate('subscription-form', { edit: s })}
          />
        );

      case 'goals':
        return (
          <GoalsScreen
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('goal-form')}
          />
        );
      case 'goal-form':
        return (
          <GoalForm
            theme={theme}
            onBack={goBack}
          />
        );
      case 'subscription-form':
        return (
          <SubscriptionForm
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Подписка сохранена'); }}
          />
        );
      case 'notes':
        return (
          <NotesList
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('note-editor')}
            onEdit={(n) => navigate('note-editor', { edit: n })}
          />
        );
      case 'note-editor':
        return (
          <NoteEditor
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Заметка сохранена'); }}
          />
        );
      case 'documents':
        return (
          <DocumentsList
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('document-form')}
            onEdit={(d) => navigate('document-form', { edit: d })}
          />
        );
      case 'document-form':
        return (
          <DocumentForm
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Документ сохранён'); }}
          />
        );
      case 'sleep':
        return (
          <SleepScreen
            theme={theme}
            onBack={goBack}
            onAdd={() => navigate('sleep-form')}
          />
        );
      case 'sleep-form':
        return (
          <SleepForm
            theme={theme}
            existing={sub.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Сон записан'); }}
          />
        );
      case 'settings':
        return (
          <SettingsModule
            theme={theme}
            onThemeChange={setTheme}
            initialView={sub?.subScreen}
            onBack={goBack}
          />
        );

      case 'tasks':
        return (
          <TasksList
            theme={theme}
            onBack={goBack}
            onNavigate={navigate}
            onAdd={() => navigate('task-form')}
            initialView={sub?.view}
            onToast={showToast}
          />
        );

      /* Dashboard widget → module subscreens */
      case 'finance':
      case 'finances':
        return <FinancesModule theme={theme} initialView={sub?.subScreen} onBack={goBack} onNavigate={navigate} onToast={showToast} />;
      case 'invest':
        return <InvestModule theme={theme} initialView={sub?.subScreen} onBack={goBack} onNavigate={navigate} onToast={showToast} />;
      case 'sport':
      case 'body':
        return <SportModule theme={theme} initialView={sub?.subScreen} onBack={goBack} />;
      case 'nutrition':
        return <NutritionScreen theme={theme} onBack={goBack} />;

      /* TasksList sends camelCase route names */
      case 'taskDetail':
        return (
          <TaskDetail
            theme={theme}
            taskId={sub.taskId}
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      case 'taskForm':
        return (
          <TaskForm
            theme={theme}
            existing={sub?.edit}
            onBack={goBack}
            onSave={() => { goBack(); showToast('Задача сохранена'); }}
          />
        );

      /* Health */
      case 'health':
        return <HealthHub theme={theme} onBack={goBack} onNavigate={navigate} />;

      /* Nutrition extras */
      case 'shopping':
        return <ShoppingList theme={theme} onBack={goBack} />;
      case 'barcode-scanner':
        return <BarcodeScanner theme={theme} onClose={goBack} onProductFound={(p) => { goBack(); navigate('food-search', { product: p }); }} />;
      case 'water':
        return <WaterTracker date={new Date().toISOString().slice(0, 10)} theme={theme} onUpdate={goBack} />;

      /* Finance extras */
      case 'utilities':
        return <UtilitiesScreen theme={theme} onClose={goBack} />;

      /* Settings extras */
      case 'analytics':
        return <AnalyticsScreen theme={theme} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen theme={theme} onBack={goBack} />;

      /* Sport extras */
      case 'body-weight':
        return <BodyWeightLog theme={theme} onBack={goBack} />;

      /* Aliases */
      case 'sleep-add':
        return <SleepForm theme={theme} onBack={goBack} onSave={() => { goBack(); showToast('Сон записан'); }} />;

      /* Calendar as subscreen */
      case 'calendar':
        return <CalendarScreen theme={theme} onBack={goBack} onNavigate={navigate} />;

      /* Global Search */
      case 'search':
      case 'global-search':
        return <GlobalSearch theme={theme} onNavigate={navigate} onBack={goBack} />;

      case 'voice-input':
        return null;

      default:
        console.warn(`[LifeOS] Unhandled route: "${screen}"`);
        // Safety: auto-close unknown subscreens instead of showing blank
        setTimeout(() => goBack(), 0);
        return null;
    }
  };

  /* ── Main screen by tab ── */
  const renderMainScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen theme={theme} onNavigate={navigate} onToast={showToast} />;
      case 'finance':
        return (
          <FinancesModule
            theme={theme}
            onNavigate={navigate}
            onToast={showToast}
          />
        );
      case 'tasks':
        return (
          <TasksList
            theme={theme}
            onNavigate={navigate}
            onAdd={() => navigate('task-form')}
            onToast={showToast}
          />
        );
      case 'calendar':
        return (
          <CalendarScreen
            theme={theme}
            onNavigate={navigate}
          />
        );
      case 'nutrition':
        return (
          <NutritionScreen
            theme={theme}
            onNavigate={navigate}
          />
        );
      case 'sport':
        return <SportModule theme={theme} onNavigate={navigate} />;
      case 'invest':
        return <InvestModule theme={theme} onNavigate={navigate} onToast={showToast} />;
      case 'more':
        return (
          <MoreScreen
            theme={theme}
            onNavigate={navigate}
          />
        );
      default:
        return <DashboardScreen theme={theme} onNavigate={navigate} onToast={showToast} />;
    }
  };

  return (
    <ErrorBoundary theme={theme}>
      <div
        className="relative min-h-screen"
        style={{ background: theme.bg, maxWidth: 430, margin: '0 auto', paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Offline banner */}
        <OfflineBanner theme={theme} />
        {/* M1.2: Swipe-back visual feedback */}
        {overlayStyle && <div style={overlayStyle} />}

        {/* Main content — parallax shift under subscreen (isExiting delays snap-back) */}
        <div style={{
          transform: (subScreen || isExiting) ? 'translateX(-30%)' : 'translateX(0)',
          transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 300ms ease',
          opacity: (subScreen || isExiting) ? 0.5 : 1,
          pointerEvents: (subScreen || isExiting) ? 'none' : 'auto',
        }}>
          <Suspense fallback={<div style={{ minHeight: '100vh', background: theme.bg }} />}>
            {renderMainScreen()}
          </Suspense>
        </div>

        {/* Sub-screen with slide transition */}
        <TransitionWrapper active={!!subScreen} direction="left" bg={theme.bg}>
          <Suspense fallback={<div style={{ minHeight: '100vh', background: theme.bg }} />}>
            {renderSubScreen()}
          </Suspense>
        </TransitionWrapper>

        {/* Tab bar (hidden on sub-screens) */}
        {!subScreen && (
          <TabBar
            active={activeTab}
            onChange={(tab) => {
              if (appNavLockRef.current) return;
              appNavLockRef.current = true;
              setTimeout(() => { appNavLockRef.current = false; }, 200);
              logNav('TAB', tab); router.reset(); setActiveTab(tab);
            }}
            onQuickAdd={() => setQuickAddOpen(true)}
            theme={theme}
          />
        )}

        {/* Quick Add Sheet */}
        <QuickAddSheet
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          theme={theme}
          onToast={showToast}
          onNavigate={(screen, data) => {
            setQuickAddOpen(false);
            navigate(screen, data);
          }}
        />

        {/* Update Prompt */}
        {showUpdatePrompt && (
          <UpdatePrompt
            visible
            theme={theme}
            onDismiss={() => setShowUpdatePrompt(false)}
          />
        )}

        {/* P2 — Blur overlay */}
        {blurred && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: theme.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(30px)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>🔒</div>
              <div style={{ color: theme.gray1, marginTop: 8 }}>LifeOS</div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
