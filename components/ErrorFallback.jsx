/**
 * ErrorFallback — UI для пойманной ошибки.
 * Props: error, onRetry, module, theme.
 */
export default function ErrorFallback({ error, onRetry, module, theme }) {
  const t = theme || {};

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4">⚠️</div>

      <div className="text-lg font-bold mb-2" style={{ color: t.text || '#000' }}>
        Ошибка{module ? ` в модуле «${module}»` : ''}
      </div>

      <div className="text-sm mb-2" style={{ color: t.gray1 || '#666' }}>
        Что-то пошло не так.
      </div>

      <div className="text-sm mb-6" style={{ color: t.gray1 || '#666' }}>
        Данные в безопасности.
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl text-white font-semibold mb-6"
          style={{ background: t.accent || '#007AFF' }}
        >
          Попробовать снова
        </button>
      )}

      <div className="text-xs" style={{ color: t.gray2 || '#999' }}>
        Если повторяется — экспортируй данные<br />
        в Настройки → Данные
      </div>

      {error?.message && (
        <div
          className="mt-4 px-3 py-2 rounded-lg text-[10px] max-w-xs break-all"
          style={{ background: t.gray6 || '#f5f5f5', color: t.gray2 || '#999' }}
        >
          {error.message}
        </div>
      )}
    </div>
  );
}
