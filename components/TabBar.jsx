import { useRef } from 'react';
import { haptic } from '../utils/ios';

export default function TabBar({ active, onChange, onQuickAdd, theme, quickOpen }) {
  const lastTap = useRef({});

  const tabs = [
    { id: 'dashboard', icon: '🏠', label: 'Главная' },
    { id: 'tasks', icon: '📋', label: 'Задачи' },
    { id: 'quick', icon: '＋', label: '' },
    { id: 'nutrition', icon: '🍎', label: 'Еда' },
    { id: 'more', icon: '···', label: 'Ещё' },
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
      background: theme.card,
      borderTop: `0.5px solid ${theme.gray5}`,
      zIndex: 100,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabPress(tab.id)}
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
          }}
        >
          {tab.id === 'quick' ? (
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 24, fontWeight: 300,
              marginTop: -16,
              transform: quickOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}>＋</div>
          ) : (
            <>
              <span style={{
                fontSize: 24,
                opacity: active === tab.id ? 1 : 0.4,
              }}>{tab.icon}</span>
              <span style={{
                fontSize: 10,
                color: active === tab.id ? theme.accent : theme.gray1,
                fontWeight: active === tab.id ? 600 : 400,
              }}>{tab.label}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
