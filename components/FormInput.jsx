/**
 * FormInput — единый styled input для всех форм.
 * @param {string} value
 * @param {function} onChange
 * @param {string} placeholder
 * @param {string} type - text|number|textarea
 * @param {string} label
 * @param {object} theme
 */
export default function FormInput({
  value, onChange, placeholder, type = 'text', label, theme,
  inputMode, autoFocus, disabled, maxLength, rows = 3, style: extraStyle,
  ...rest
}) {
  const baseStyle = {
    width: '100%',
    background: theme.gray6,
    color: theme.text,
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 16,
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    WebkitAppearance: 'none',
    opacity: disabled ? 0.5 : 1,
    ...extraStyle,
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={{ color: theme.gray1 }}>
          {label}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          maxLength={maxLength}
          style={{ ...baseStyle, resize: 'none' }}
          {...rest}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode || (type === 'number' ? 'numeric' : undefined)}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={maxLength}
          style={baseStyle}
          {...rest}
        />
      )}
    </div>
  );
}
