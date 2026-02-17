/**
 * StatusDot — цветной индикатор статуса.
 * 🟢 good, 🟡 warning, 🔴 over, ⚪ neutral.
 * @param {'good'|'warning'|'over'|'neutral'} status
 * @param {number} size - px (default 8)
 * @param {object} theme
 */
export default function StatusDot({ status = 'neutral', size = 8, theme }) {
  const colors = {
    good: theme.green || '#34C759',
    warning: theme.yellow || '#FFD60A',
    over: theme.red || '#FF3B30',
    neutral: theme.gray3 || '#C7C7CC',
  };

  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: colors[status] || colors.neutral,
      }}
    />
  );
}
