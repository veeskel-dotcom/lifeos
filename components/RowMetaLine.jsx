/**
 * RowMetaLine — строка мета-данных в виде мини-чипсов.
 * Эталон: Things 3 / Todoist — дедлайн, проект, теги как chips под заголовком.
 * @param {{ icon?: string, label: string, color?: string }[]} items
 * @param {object} theme
 */
export default function RowMetaLine({ items, theme }) {
  if (!items?.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.filter(Boolean).map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{
            background: (item.color || theme.accent) + '15',
            color: item.color || theme.gray1,
          }}
        >
          {item.icon && <span className="text-[10px]">{item.icon}</span>}
          {item.label}
        </span>
      ))}
    </div>
  );
}
