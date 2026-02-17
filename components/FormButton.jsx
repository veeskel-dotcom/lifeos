/**
 * FormButton — 3 варианта кнопок.
 * variant: primary | secondary | destructive
 * size: sm | md | lg | full
 */
export default function FormButton({
  children, onClick, variant = 'primary', size = 'md', disabled, theme, style: extraStyle,
}) {
  const variants = {
    primary: { bg: theme.accent, color: '#fff', fontWeight: 600 },
    secondary: { bg: theme.gray6, color: theme.text, fontWeight: 500 },
    destructive: { bg: theme.red + '15', color: theme.red, fontWeight: 600 },
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13, borderRadius: 10 },
    md: { padding: '10px 20px', fontSize: 15, borderRadius: 12 },
    lg: { padding: '14px 24px', fontSize: 17, borderRadius: 14 },
    full: { padding: '14px 24px', fontSize: 17, borderRadius: 14, width: '100%' },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: v.bg,
        color: v.color,
        fontWeight: v.fontWeight,
        ...s,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        textAlign: 'center',
        transition: 'opacity 0.15s',
        ...extraStyle,
      }}
      className="active:opacity-70"
    >
      {children}
    </button>
  );
}
