const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * DateSectionHeader — заголовок секции для группировки по дням.
 * Эталон: Copilot Transactions, Apple Wallet.
 * Показывает: «Сегодня, 15 января» / «Вчера» / «Пн, 13 января» / полная дата.
 * @param {string} dateStr - ISO date 'YYYY-MM-DD'
 * @param {number} total - сумма за день (опц.)
 * @param {string} currency - символ валюты
 * @param {object} theme
 */
export default function DateSectionHeader({ dateStr, total, currency = '₸', theme }) {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  let label;
  if (dateStr === today) {
    label = `Сегодня, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  } else if (dateStr === yesterday) {
    label = `Вчера, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  } else if (d.getFullYear() === now.getFullYear()) {
    label = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  } else {
    label = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <div className="flex items-center justify-between py-2 px-1 sticky top-0 z-10"
      style={{ background: theme.bg }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gray1 }}>
        {label}
      </span>
      {total != null && (
        <span className="text-xs font-medium tabular-nums" style={{ color: theme.gray2 }}>
          {Math.round(total).toLocaleString('ru-RU')} {currency}
        </span>
      )}
    </div>
  );
}
