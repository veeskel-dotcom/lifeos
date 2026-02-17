/**
 * DashboardScreen — Главный экран LifeOS.
 * Greeting + DailyTip (вне grid) + DashboardGrid (configurable).
 * Config хранится в IndexedDB через getSetting/setSetting.
 */
import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '../components/PullToRefresh';
import { useDashboardData } from '../hooks/useDashboardData';
import { getSetting, setSetting } from '../db/helpers';
import DashboardGrid from './dashboard/DashboardGrid';
import DashboardEditor from './dashboard/DashboardEditor';
import { generateDefaultConfig, mergeConfig, WIDGETS } from './dashboard/widgetRegistry';
import { getDailyTip } from '../services/dailyTip';
import { checkMilestones } from '../services/milestones';
import { getOverdueRoutines } from '../services/routines';
import { getBedtimeRecommendation } from '../services/sleep';
import TutorialTip from '../components/TutorialTip';

const GREETINGS = [
  { from: 5, to: 12, text: 'Доброе утро' },
  { from: 12, to: 17, text: 'Добрый день' },
  { from: 17, to: 22, text: 'Добрый вечер' },
  { from: 22, to: 5, text: 'Доброй ночи' },
];

function getGreeting() {
  const h = new Date().getHours();
  for (const g of GREETINGS) {
    if (g.from < g.to) {
      if (h >= g.from && h < g.to) return g.text;
    } else {
      if (h >= g.from || h < g.to) return g.text;
    }
  }
  return 'Привет';
}

export default function DashboardScreen({ theme, onNavigate, onToast }) {
  const dashboardData = useDashboardData();
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [enabledModules, setEnabledModules] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
    await new Promise(r => setTimeout(r, 400));
  }, []);

  // N5: load enabled modules + dashboard config
  useEffect(() => {
    (async () => {
      try {
        // Dashboard config
        const raw = await getSetting('dashboard_config');
        const saved = raw ? JSON.parse(raw) : null;
        setConfig(mergeConfig(saved));
        // N5: enabled modules
        const mods = await getSetting('enabled_modules');
        if (mods) try { setEnabledModules(new Set(JSON.parse(mods))); } catch {}
      } catch {
        setConfig(generateDefaultConfig());
      }
    })();
  }, []);

  // Q2.4: milestones + F3: overdue routines + H6: bedtime reminder
  useEffect(() => {
    checkMilestones()
      .then(ms => { ms.forEach(m => onToast?.(`${m.emoji} ${m.message}`)); })
      .catch(() => {});
    getOverdueRoutines()
      .then(overdue => {
        if (overdue.length > 0) {
          const names = overdue.slice(0, 3).map(r => r.name).join(', ');
          onToast?.(`⏰ Не забудь: ${names}${overdue.length > 3 ? ` (+${overdue.length - 3})` : ''}`);
        }
      })
      .catch(() => {});
    getBedtimeRecommendation()
      .then(rec => {
        if (!rec?.bedtime) return;
        const now = new Date();
        const [bH, bM] = rec.bedtime.split(':').map(Number);
        const bedtime = new Date(); bedtime.setHours(bH, bM, 0, 0);
        const diff = (now - bedtime) / 60000;
        if (diff > 0 && diff < 90) {
          onToast?.(`🌙 Пора спать! Рекомендация: ${rec.bedtime}`);
        }
      })
      .catch(() => {});
  }, []);

  // Save config
  const handleSaveConfig = useCallback(async (newConfig) => {
    setConfig(newConfig);
    try {
      await setSetting('dashboard_config', JSON.stringify(newConfig));
    } catch (e) {
      console.error('[DashboardScreen] save config error:', e);
    }
  }, []);

  // N5: filter config by enabled_modules
  const filteredConfig = config ? config.filter(item => {
    const widgetDef = WIDGETS.find(w => w.id === item.id);
    if (!widgetDef || !widgetDef.module) return true; // always show module=null
    if (!enabledModules) return true; // no restriction
    return enabledModules.has(widgetDef.module);
  }) : null;

  // Editor mode
  if (editing && config) {
    return (
      <DashboardEditor
        config={config}
        onSave={handleSaveConfig}
        onBack={() => setEditing(false)}
        theme={theme}
      />
    );
  }

  const greeting = getGreeting();

  return (
    <PullToRefresh onRefresh={handleRefresh} theme={theme}>
    <div key={refreshKey} className="min-h-screen pb-24" style={{ background: theme.bg }}>
      {/* ── Header ── */}
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold" style={{ color: theme.text }}>{greeting} 👋</div>
            <div
              className="text-xs mt-0.5 cursor-pointer active:opacity-60"
              style={{ color: theme.gray2 }}
              onClick={() => onNavigate?.('tasks', { view: 'calendar' })}
            >
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span className="ml-1" style={{ color: theme.accent }}>📅</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{
              background: theme.card,
              border: `0.5px solid ${theme.gray5}`,
              color: theme.gray1,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <span style={{ fontSize: 14 }}>⚙️</span>
            <span>Настроить</span>
          </button>
        </div>
      </div>

      {/* ── Daily Tip (outside grid) ── */}
      <div className="px-4">
        <DailyTipBanner theme={theme} />
      </div>

      {/* ── Tutorial ── */}
      <div className="px-4">
        <TutorialTip id="dashboard_welcome" theme={theme} icon="👋">
          Нажмите ⚙️ Настроить, чтобы показать/скрыть виджеты, изменить размер и порядок.
        </TutorialTip>
      </div>

      {/* ── Widget Grid ── */}
      <div className="px-4 mt-2">
        {filteredConfig ? (
          <DashboardGrid
            config={filteredConfig}
            theme={theme}
            onNavigate={onNavigate}
            dashboardData={dashboardData}
            onReorder={(reordered) => {
              // Merge reordered visible items back into full config
              const orderMap = Object.fromEntries(reordered.map(r => [r.id, r.order]));
              const merged = config.map(item =>
                orderMap[item.id] !== undefined ? { ...item, order: orderMap[item.id] } : item
              );
              handleSaveConfig(merged);
            }}
          />
        ) : (
          /* Config loading shimmer */
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="animate-pulse"
                style={{ background: theme.card, borderRadius: 20, height: 140 }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}

/* ── DailyTip (full-width, above grid) ── */
function DailyTipBanner({ theme }) {
  const [tip, setTip] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { getDailyTip().then(setTip); }, []);

  if (!tip || dismissed) return null;

  return (
    <div className="mb-3">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-2xl"
        style={{ background: theme.accent + '08', border: `0.5px solid ${theme.accent}20` }}
      >
        <span className="text-lg mt-0.5">{tip.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-0.5" style={{ color: theme.accent }}>Совет дня</div>
          <div className="text-xs" style={{ color: theme.text }}>{tip.text}</div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs mt-0.5"
          style={{ color: theme.gray3, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
