/**
 * AboutScreen — О приложении (proto S11).
 * Logo, info rows, changelog, licenses.
 */
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';

const CHANGELOG = [
  { v: '1.0.0', date: '15 фев', changes: 'Первый релиз: финансы, питание, спорт, AI' },
  { v: '0.9.0', date: '1 фев', changes: 'Бета: инвестиции, рутины, видеоанализ' },
  { v: '0.8.0', date: '15 янв', changes: 'Альфа: дашборд, задачи, PIN-защита' },
];

const INFO_ROWS = [
  { label: 'Разработчик', value: 'Сергей' },
  { label: 'Платформа', value: 'PWA · Офлайн-first' },
  { label: 'Стек', value: 'React · Dexie.js' },
  { label: 'База данных', value: 'IndexedDB' },
];

export default function AboutScreen({ theme, onBack }) {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="О приложении" onBack={onBack} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* Logo */}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || '#5856D6'})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 28, color: '#fff', fontWeight: 700 }}>L</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>LifeOS</div>
          <div style={{ fontSize: 13, color: theme.gray2, marginTop: 2 }}>Версия 1.0.0 (сборка 42)</div>
        </div>

        {/* Info */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {INFO_ROWS.map((r, i) => (
            <div key={r.label} className="flex items-center justify-between"
              style={{ padding: '12px 14px', borderBottom: i < INFO_ROWS.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 400, color: theme.gray1 }}>{r.value}</span>
            </div>
          ))}
        </Card>

        {/* Changelog */}
        <div style={{ padding: '0 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ПОСЛЕДНИЕ ОБНОВЛЕНИЯ</span>
        </div>
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {CHANGELOG.map((c, i) => (
            <div key={c.v} style={{ padding: '12px 14px', borderBottom: i < CHANGELOG.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
              <div className="flex justify-between" style={{ marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>v{c.v}</span>
                <span style={{ fontSize: 12, color: theme.gray3 }}>{c.date}</span>
              </div>
              <div style={{ fontSize: 13, color: theme.gray2 }}>{c.changes}</div>
            </div>
          ))}
        </Card>

        {/* Licenses */}
        <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <div className="flex items-center" style={{ padding: '12px 14px' }}>
            <div className="flex-1">
              <div style={{ fontSize: 15, fontWeight: 400, color: theme.text }}>Лицензии</div>
              <div style={{ fontSize: 12, color: theme.gray2 }}>Open-source зависимости</div>
            </div>
            <span style={{ fontSize: 14, color: theme.gray3 }}>→</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
