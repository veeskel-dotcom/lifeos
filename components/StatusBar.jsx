/**
 * StatusBar — верхний отступ для PWA standalone режима.
 * В standalone (Add to Home Screen) системный status bar накладывается на контент.
 * Этот компонент добавляет safe-area padding сверху.
 */
export default function StatusBar({ theme }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 20px 4px',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: '-apple-system, system-ui, sans-serif',
      color: theme.text,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {/* Signal bars */}
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M1 4h2v8H1zM5 2.5h2V12H5zM9 1h2v11H9zM13 0h2v12h-2z" fill={theme.text} />
        </svg>
        {/* WiFi */}
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 3.5C9.4 3.5 11.1 4.3 12.3 5.5L13.7 4.1C12.1 2.5 10 1.5 7.5 1.5S2.9 2.5 1.3 4.1L2.7 5.5C3.9 4.3 5.6 3.5 7.5 3.5z" fill={theme.text} />
          <path d="M7.5 6.5c1.2 0 2.3.5 3.1 1.3l1.4-1.4C10.8 5.2 9.2 4.5 7.5 4.5S4.2 5.2 3 6.4l1.4 1.4C5.2 7 6.3 6.5 7.5 6.5z" fill={theme.text} />
          <circle cx="7.5" cy="10" r="1.5" fill={theme.text} />
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0" y="1" width="22" height="10" rx="2" stroke={theme.text} strokeWidth="1" fill="none" />
          <rect x="23" y="4" width="2" height="4" rx="1" fill={theme.text} />
          <rect x="2" y="3" width="14" height="6" rx="1" fill={theme.green} />
        </svg>
      </div>
    </div>
  );
}
