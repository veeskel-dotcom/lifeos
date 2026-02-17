/**
 * Card — контейнер с закруглёнными углами (borderRadius: 16).
 * Принимает theme для цвета фона.
 */
export default function Card({ children, style, onClick, theme }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme?.card || '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
