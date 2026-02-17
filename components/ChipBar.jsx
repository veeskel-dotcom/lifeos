/**
 * ChipBar — горизонтальная полоса фильтров-чипсов.
 * Эталон: Copilot Transactions chips, Todoist filter bar.
 * Горизонтальный скролл, без скроллбара, активный чип = accent.
 * @param {{ id: string, label: string, icon?: string }[]} chips
 * @param {string} active - id активного чипа
 * @param {function} onChange - (id) => void
 * @param {object} theme
 */
export default function ChipBar({ chips, active, onChange, theme }) {
  if (!chips?.length) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1"
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
    >
      {chips.map(chip => {
        const isActive = chip.id === active;
        return (
          <button
            key={chip.id}
            onClick={() => onChange(chip.id)}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
            style={{
              background: isActive ? theme.accent : theme.gray6 || theme.card,
              color: isActive ? '#fff' : theme.gray1,
              border: isActive ? 'none' : `0.5px solid ${theme.gray5}`,
              whiteSpace: 'nowrap',
            }}
          >
            {chip.icon && <span>{chip.icon}</span>}
            {chip.label}
          </button>
        );
      })}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
