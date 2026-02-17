import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../db/helpers';

/**
 * L5: Tutorial tooltip — показывается один раз при первом визите на экран.
 * 
 * Usage:
 *   <TutorialTip id="dashboard_welcome" theme={theme}>
 *     Свайп влево для навигации назад
 *   </TutorialTip>
 */
export default function TutorialTip({ id, theme, children, icon = '💡', position = 'bottom' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const seen = await getSetting(`tip_seen_${id}`);
      if (!seen && mounted) setVisible(true);
    })();
    return () => { mounted = false; };
  }, [id]);

  const dismiss = async () => {
    setVisible(false);
    await setSetting(`tip_seen_${id}`, true);
  };

  if (!visible) return null;

  return (
    <div
      className="mx-4 my-2 flex items-start gap-3 rounded-2xl px-4 py-3 animate-fadeIn"
      style={{
        background: theme.accent + '12',
        border: `1px solid ${theme.accent}30`,
      }}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{ color: theme.text }}>{children}</div>
      </div>
      <button
        onClick={dismiss}
        className="text-xs font-medium flex-shrink-0 px-2 py-1 rounded-lg"
        style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        OK
      </button>
    </div>
  );
}

/**
 * Reset all tutorial tips (for testing / settings).
 */
export async function resetAllTips() {
  const { default: db } = await import('../db/index');
  const allSettings = await db.settings.toArray();
  const tipKeys = allSettings.filter(s => s.key.startsWith('tip_seen_')).map(s => s.key);
  for (const key of tipKeys) {
    await db.settings.delete(key);
  }
}
