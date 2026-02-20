import { useRef } from 'react';
import { haptic } from '../utils/ios';

/* SVG line icons — prototype design system */
const ICONS = {
  home: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="9" y="14" width="6" height="7" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  tasks: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" />
      <path d="M8 12l3 3 5-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  nutrition: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 21c3-3 8-4 12-8 1-2 2-5 0-8-3-2-6-1-8 0C6 9 5 14 2 17" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 21c0-4 2-7 6-10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  more: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="2" fill={color} />
      <circle cx="12" cy="12" r="2" fill={color} />
      <circle cx="19" cy="12" r="2" fill={color} />
    </svg>
  ),
};

export default function TabBar({ active, onChange, onQuickAdd, theme, quickOpen }) {
  const lastTap = useRef({});

  const tabs = [
    { id: 'dashboard', icon: 'home', label: 'Главная' },
    { id: 'tasks', icon: 'tasks', label: 'Задачи' },
    { id: 'quick', icon: null, label: '' },
    { id: 'nutrition', icon: 'nutrition', label: 'Еда' },
    { id: 'more', icon: 'more', label: 'Ещё' },
  ];

  const handleTabPress = (tabId) => {
    haptic('light');
    if (tabId === 'quick') {
      onQuickAdd?.();
      return;
    }
    // Double-tap same tab → scroll to top
    if (tabId === active) {
      const now = Date.now();
      if (now - (lastTap.current[tabId] || 0) < 400) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      lastTap.current[tabId] = now;
    }
    onChange?.(tabId);
  };

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: 80,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${theme.gray5}`,
      zIndex: 100,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabPress(tab.id)}
          aria-label={tab.id === 'quick' ? 'Быстрое добавление' : tab.label}
          aria-current={tab.id !== 'quick' && active === tab.id ? 'page' : undefined}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0',
            fontFamily: 'inherit',
            minHeight: 44,
          }}
        >
          {tab.id === 'quick' ? (
            <div style={{
              width: 48, height: 48, borderRadius: 24,
              background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: -16,
              boxShadow: '0 4px 12px rgba(0,122,255,0.35)',
              transform: quickOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <>
              <div>
                {ICONS[tab.icon]?.(active === tab.id ? theme.accent : theme.gray2)}
              </div>
              <span style={{
                fontSize: 10,
                color: active === tab.id ? theme.accent : theme.gray2,
                fontWeight: active === tab.id ? 600 : 400,
              }}>{tab.label}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
