export default function ScreenWrapper({ children, noScroll = false, noPadBottom = false, theme }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: theme.bg,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: noPadBottom ? 0 : 'calc(80px + env(safe-area-inset-bottom, 0px))',
      overflowY: noScroll ? 'hidden' : 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {children}
    </div>
  );
}
