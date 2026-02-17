export default function SafeArea({ children, top = true, bottom = true }) {
  return (
    <div style={{
      paddingTop: top ? 'env(safe-area-inset-top)' : 0,
      paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : 0,
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      {children}
    </div>
  );
}
