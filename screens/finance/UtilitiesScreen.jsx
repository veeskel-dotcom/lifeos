import { useState, useCallback, useRef } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';
import InputSheet from '../../components/InputSheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import { fmtMoney } from '../../utils/currency';

const SERVICES = [
  { id: 'cold_water', emoji: '💧', name: 'Вода хол.', hasMeter: true, unit: 'м³', color: '#007AFF' },
  { id: 'hot_water', emoji: '🔥', name: 'Вода гор.', hasMeter: true, unit: 'м³', color: '#FF3B30' },
  { id: 'electricity', emoji: '⚡', name: 'Электрич.', hasMeter: true, unit: 'кВт·ч', color: '#FFCC00' },
  { id: 'gas', emoji: '🔥', name: 'Газ', hasMeter: false, color: '#FF9500' },
  { id: 'heating', emoji: '🏠', name: 'Отопление', hasMeter: false, color: '#FF3B30' },
  { id: 'maintenance', emoji: '🏗', name: 'Капремонт', hasMeter: false, color: '#8E8E93' },
  { id: 'waste', emoji: '🗑', name: 'ТКО', hasMeter: false, color: '#636366' },
];

export default function UtilitiesScreen({ onClose, theme }) {
  const [meterInput, setMeterInput] = useState(null); // { serviceId, label }
  const [month] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7);
  });

  const data = useLiveQuery(async () => {
    const db = (await import('../../db')).default;
    const records = await db.utilities.where('month').equals(month).toArray();
    const history = await db.utilities.orderBy('month').reverse().limit(60).toArray();
    return { records, history };
  }, [month]);

  const records = data?.records || [];
  const monthlyHistory = data?.history || [];

  // Group history by month for chart
  const monthTotals = {};
  monthlyHistory.forEach(r => {
    monthTotals[r.month] = (monthTotals[r.month] || 0) + (r.amount || 0);
  });
  const chartMonths = Object.entries(monthTotals).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const chartMax = Math.max(...chartMonths.map(m => m[1]), 1);

  const totalMonth = records.reduce((s, r) => s + (r.amount || 0), 0);

  // Days until 25th
  const now = new Date();
  const day25 = new Date(now.getFullYear(), now.getMonth(), 25);
  if (day25 < now) day25.setMonth(day25.getMonth() + 1);
  const daysLeft = Math.ceil((day25 - now) / 86400000);

  const handleMeterSubmit = useCallback(async (value) => {
    if (!meterInput) return;
    const db = (await import('../../db')).default;
    const existing = records.find(r => r.service_id === meterInput.serviceId && r.month === month);
    const reading = parseFloat(value);
    if (isNaN(reading)) return;
    if (existing) {
      await db.utilities.update(existing.id, { current_reading: reading, updated_at: new Date().toISOString() });
    } else {
      await db.utilities.add({
        service_id: meterInput.serviceId,
        month,
        current_reading: reading,
        amount: 0,
        created_at: new Date().toISOString(),
      });
    }
    setMeterInput(null);
  }, [meterInput, month, records]);

  const getServiceRecord = (serviceId) => records.find(r => r.service_id === serviceId);

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const monthLabel = monthNames[parseInt(month.slice(5)) - 1] + ' ' + month.slice(0, 4);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="ЖКХ" onBack={onClose} right={monthLabel} theme={theme} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Total + deadline */}
        <Card theme={theme} style={{ marginBottom: 8 }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs" style={{ color: theme.gray2 }}>{monthLabel}</div>
              <div className="text-3xl font-bold mt-0.5">{fmtMoney(totalMonth)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium" style={{ color: theme.orange }}>⚠️ Показания до 25-го</div>
              <div className="text-xs" style={{ color: theme.gray2 }}>через {daysLeft} дн.</div>
            </div>
          </div>
          {/* Payment status */}
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{ background: theme.orange + '08' }}>
            <span>📋</span>
            <span className="font-medium" style={{ color: theme.orange }}>Оплатить до 10-го</span>
            <button className="ml-auto text-sm font-medium" style={{ color: theme.accent }}>Оплачено ✓</button>
          </div>
        </Card>

        {/* Services */}
        <div className="text-xs font-semibold uppercase tracking-wide mb-1 mt-4" style={{ color: theme.gray1 }}>Услуги</div>
        <Card theme={theme} style={{ marginBottom: 8, padding: 0 }}>
          {SERVICES.map((svc, i) => {
            const rec = getServiceRecord(svc.id);
            return (
              <div key={svc.id} className="flex items-center gap-2 px-3.5 py-2.5"
                style={{ borderBottom: i < SERVICES.length - 1 ? `0.5px solid ${theme.gray5}` : 'none' }}>
                <span className="text-lg w-7 text-center">{svc.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: theme.text }}>{svc.name}</div>
                  {svc.hasMeter && rec?.current_reading != null && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs" style={{ color: theme.gray2 }}>Показ: {rec.current_reading}</span>
                      {rec.previous_reading != null && (
                        <span className="text-xs font-medium" style={{ color: svc.color }}>
                          (+{(rec.current_reading - rec.previous_reading).toFixed(1)} {svc.unit})
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>
                  {rec?.amount ? fmtMoney(rec.amount) : '—'}
                </span>
                {svc.hasMeter && (
                  <button
                    className="text-xs font-medium ml-1"
                    style={{ color: theme.accent }}
                    onClick={() => setMeterInput({ serviceId: svc.id, label: svc.name })}
                  >
                    Подать →
                  </button>
                )}
              </div>
            );
          })}
        </Card>

        {/* Photo receipt */}
        <Card theme={theme} style={{ marginBottom: 8, padding: '12px 14px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: theme.orange + '12' }}>📷</div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: theme.text }}>Фото квитанции → AI</div>
              <div className="text-xs" style={{ color: theme.gray2 }}>Распознать показания автоматически</div>
            </div>
            <span style={{ color: theme.gray3 }}>→</span>
          </div>
        </Card>

        {/* History chart */}
        {chartMonths.length > 1 && (
          <>
            <div style={{ padding: '0 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.gray1 }}>ИСТОРИЯ</span>
            </div>
            <Card theme={theme} style={{ marginBottom: 8, padding: '12px 14px' }}>
              <div className="text-xs mb-2" style={{ color: theme.gray2 }}>
                Среднее: {fmtMoney(Math.round(chartMonths.reduce((s, m) => s + m[1], 0) / chartMonths.length))}/мес
              </div>
              <div className="flex items-end" style={{ height: 32, gap: 6 }}>
                {chartMonths.map(([m, val], i) => (
                  <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-sm"
                      style={{
                        height: Math.max(2, (val / chartMax) * 30),
                        background: i === chartMonths.length - 1 ? theme.teal || theme.accent : (theme.teal || theme.accent) + '40',
                      }} />
                    <span className="text-[9px]" style={{ color: theme.gray3 }}>
                      {monthNames[parseInt(m.slice(5)) - 1]?.[0]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <InputSheet
        open={!!meterInput}
        onClose={() => setMeterInput(null)}
        title={`Показания: ${meterInput?.label || ''}`}
        placeholder="Введите показание"
        type="number"
        inputMode="decimal"
        onSubmit={handleMeterSubmit}
        submitLabel="Подать"
        theme={theme}
      />
    </div>
  );
}
