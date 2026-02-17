import { useState, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useDB';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ProgressBar from '../../components/ProgressBar';

const DAYS = [
  { day: 'Понедельник', short: 'Пн' },
  { day: 'Вторник', short: 'Вт' },
  { day: 'Среда', short: 'Ср' },
  { day: 'Четверг', short: 'Чт' },
  { day: 'Пятница', short: 'Пт' },
  { day: 'Суббота', short: 'Сб' },
  { day: 'Воскресенье', short: 'Вс' },
];

function ChipBar({ items, active, onSelect, theme }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
      {items.map(t => (
        <div key={t.key} onClick={() => onSelect(t.key)}
          style={{ flex: 1, padding: '7px 0', borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: active === t.key ? theme.accent : theme.card,
            color: active === t.key ? '#fff' : theme.gray1,
            boxShadow: active === t.key ? 'none' : theme.shadow,
          }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}

function ProgramView({ program, theme, onRegenerate, onEdit, onStartWorkout }) {
  const todayIdx = new Date().getDay(); // 0=Sun
  const todayKey = todayIdx === 0 ? 6 : todayIdx - 1; // 0=Mon

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Current program card */}
      <Card theme={theme} style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: (theme.purple || '#AF52DE') + '15' }}>🤖</div>
          <div>
            <div style={{ color: theme.text, fontSize: 15, fontWeight: 600 }}>Ваша программа</div>
            <div style={{ color: theme.gray2, fontSize: 12 }}>
              Сгенерирована AI · {program?.updatedAt || 'нет данных'}
            </div>
          </div>
        </div>

        <div style={{ background: (theme.purple || '#AF52DE') + '08', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          {[
            { label: 'Цель', value: program?.goal || 'Не задана' },
            { label: 'Сплит', value: program?.split || '—' },
            { label: 'Дней в неделю', value: program?.daysPerWeek || '—' },
            { label: 'Фаза', value: program?.phase || '—', color: theme.accent },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: theme.gray1, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: row.color || theme.text, fontSize: 13, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Periodization */}
        {program?.totalWeeks && (
          <>
            <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ПЕРИОДИЗАЦИЯ</div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
              {Array.from({ length: program.totalWeeks }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i < (program.currentWeek || 0) ? theme.accent : theme.gray4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: i < (program.currentWeek || 0) ? '#fff' : theme.gray2 }}>{i + 1}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Weekly split */}
      <div style={{ color: theme.gray1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 8, marginBottom: 4 }}>
        Расписание недели
      </div>
      <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
        {(program?.schedule || []).map((s, i) => {
          const isToday = i === todayKey;
          const colors = { push: theme.red, pull: theme.accent, legs: theme.purple, upper: theme.orange, rest: theme.gray3 };
          const barColor = colors[s.type] || theme.gray3;
          return (
            <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderBottom: i < 6 ? `0.5px solid ${theme.gray5}` : 'none',
                background: isToday ? theme.accent + '06' : 'transparent',
              }}>
              <div style={{ width: 6, height: 28, borderRadius: 3, background: s.rest ? theme.gray4 : barColor }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: isToday ? 600 : 400, color: theme.text, fontSize: 14 }}>{DAYS[i].day}</span>
                  {isToday && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, color: theme.accent, background: theme.accent + '12' }}>СЕГОДНЯ</span>
                  )}
                </div>
                <div style={{ color: theme.gray2, fontSize: 12 }}>
                  {s.name}{s.exercises > 0 ? ` · ${s.exercises} упр · ${s.duration}` : ` · ${s.duration || 'Восстановление'}`}
                </div>
              </div>
              {s.done && (
                <div style={{ width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.green }}>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>
                </div>
              )}
              {isToday && !s.done && !s.rest && (
                <button style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: theme.accent, border: 'none', cursor: 'pointer' }} onClick={onStartWorkout}>Начать</button>
              )}
            </div>
          );
        })}
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={{ flex: 1, padding: 12, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
          background: (theme.purple || '#AF52DE') + '10', color: theme.purple || '#AF52DE' }} onClick={onRegenerate}>
          🤖 Пересоздать
        </button>
        <button style={{ flex: 1, padding: 12, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
          background: theme.gray5, color: theme.gray1 }} onClick={onEdit}>
          ✏️ Редактировать
        </button>
      </div>

      {/* AI recommendation */}
      {program?.aiHint && (
        <div style={{ borderRadius: 12, padding: 12, marginTop: 8, background: (theme.purple || '#AF52DE') + '06', border: '1px solid ' + (theme.purple || '#AF52DE') + '15' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <span style={{ color: theme.purple, fontSize: 12, fontWeight: 600 }}>AI рекомендация</span>
          </div>
          <div style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>{program.aiHint}</div>
        </div>
      )}
    </div>
  );
}

function SessionView({ theme }) {
  // L1: Progressive overload hints for current workout
  const exercises = [
    { name: 'Жим лёжа', last: '80 кг × 8', target: '82.5 кг × 6-8', hint: '+2.5 кг от прошлого раза' },
    { name: 'Жим гантелей на наклонной', last: '28 кг × 10', target: '28 кг × 12', hint: 'Добавь повторения' },
    { name: 'Разводка', last: '14 кг × 12', target: '16 кг × 10', hint: 'Следующая ступень веса' },
    { name: 'Французский жим', last: '30 кг × 10', target: '30 кг × 12', hint: 'Закрепи подход' },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ background: theme.accent + '08', borderRadius: 12 }}>
        <div style={{ color: theme.accent, fontSize: 14, fontWeight: 600 }}>Progressive Overload</div>
        <div style={{ color: theme.gray2, fontSize: 12, marginTop: 4 }}>
          AI анализирует ваш прогресс и предлагает целевые показатели
        </div>
      </div>

      {exercises.map((ex, i) => (
        <Card key={i} theme={theme} style={{ padding: '12px 14px' }}>
          <div style={{ color: theme.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{ex.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: theme.gray2, fontSize: 12 }}>Прошлый раз</span>
            <span style={{ color: theme.gray1, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{ex.last}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: theme.accent, fontSize: 12, fontWeight: 500 }}>Цель сегодня</span>
            <span style={{ color: theme.accent, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{ex.target}</span>
          </div>
          <div style={{ color: theme.green, fontSize: 12 }}>💡 {ex.hint}</div>
        </Card>
      ))}
    </div>
  );
}

function HintsView({ theme }) {
  const tips = [
    { icon: '🎯', title: 'Техника жима', text: 'Сведи лопатки, упрись ногами. Снаряд опускай до груди, не отбивай.' },
    { icon: '⏱', title: 'Отдых между подходами', text: 'Базовые: 2-3 мин. Изолирующие: 60-90 сек. Не больше 5 мин.' },
    { icon: '🍗', title: 'Питание после', text: 'В течение 2ч: 30-40г белка + быстрые углеводы для восстановления.' },
    { icon: '😴', title: 'Восстановление', text: 'Минимум 7ч сна. Мышцы растут во время отдыха, не в зале.' },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      {tips.map((tip, i) => (
        <Card key={i} theme={theme} style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, marginTop: 2 }}>{tip.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: theme.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{tip.title}</div>
              <div style={{ color: theme.gray1, fontSize: 13, lineHeight: '18px' }}>{tip.text}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AITrainerScreen({ theme, onBack, onStartWorkout }) {
  const [tab, setTab] = useState('program');

  // Load saved program or use demo data
  const program = useLiveQuery(async () => {
    const db = (await import('../../db')).default;
    const saved = await db.settings.get('ai_program').catch(() => null);
    return saved?.value || {
      goal: 'Масса + сила',
      split: 'Push / Pull / Legs',
      daysPerWeek: '4 (Пн/Вт/Чт/Пт)',
      phase: 'Набор (неделя 6/8)',
      totalWeeks: 8,
      currentWeek: 6,
      updatedAt: 'обновлена 10 фев',
      aiHint: 'Неделя 6: объём нагрузки на пике. На следующей неделе рекомендую deload — снизить веса на 40%, сохранить подходы.',
      schedule: [
        { name: 'Грудь + Трицепс (Push)', type: 'push', exercises: 5, duration: '~50 мин', done: true },
        { name: 'Спина + Бицепс (Pull)', type: 'pull', exercises: 5, duration: '~55 мин', done: true },
        { name: 'Отдых', type: 'rest', rest: true, duration: 'Восстановление' },
        { name: 'Ноги (Legs)', type: 'legs', exercises: 5, duration: '~55 мин', done: false },
        { name: 'Плечи + Руки (Upper)', type: 'upper', exercises: 4, duration: '~45 мин', done: false },
        { name: 'Отдых', type: 'rest', rest: true, duration: 'Восстановление' },
        { name: 'Отдых', type: 'rest', rest: true, duration: 'Восстановление' },
      ],
    };
  });

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="AI-тренер" onBack={onBack} theme={theme} />

      <ChipBar
        items={[
          { key: 'program', label: 'Программа' },
          { key: 'session', label: 'Тренировка' },
          { key: 'hint', label: 'Подсказки' },
        ]}
        active={tab}
        onSelect={setTab}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'program' && (
          <ProgramView
            program={program}
            theme={theme}
            onStartWorkout={onStartWorkout}
            onRegenerate={() => {}}
            onEdit={() => {}}
          />
        )}
        {tab === 'session' && <SessionView theme={theme} />}
        {tab === 'hint' && <HintsView theme={theme} />}
      </div>
    </div>
  );
}
