import { useCategories } from '../../hooks/useDB';

export default function CategoryPicker({ module, selected, onSelect, theme }) {
  const categories = useCategories(module);

  if (!categories) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-xl py-3 animate-pulse"
            style={{ background: theme.gray6 }}
          >
            <div className="w-6 h-6 rounded-full" style={{ background: theme.gray4 }} />
            <div className="w-8 h-2 rounded mt-1.5" style={{ background: theme.gray4 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {categories.map(cat => {
        const isSelected = cat.id === selected;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="flex flex-col items-center justify-center rounded-xl py-3 border-2 transition-colors"
            style={{
              background: isSelected ? theme.accent + '15' : theme.gray6,
              borderColor: isSelected ? theme.accent : 'transparent',
            }}
          >
            <span className="text-xl">{cat.icon}</span>
            <span
              className="text-[10px] font-medium mt-1 truncate w-full text-center px-0.5"
              style={{ color: isSelected ? theme.accent : theme.gray1 }}
            >
              {cat.name.split('/').pop()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
