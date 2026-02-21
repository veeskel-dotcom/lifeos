# LifeOS — Полный аудит: Прототипы vs Реализация

**Дата:** 2026-02-18
**Статус:** Аудит завершён, план исправлений составлен

---

## Принцип: что исправляем, что оставляем

- **ИСПРАВИТЬ** — визуальные расхождения (иконки, цвета, шрифты, лейауты)
- **ОСТАВИТЬ** — фичи реализации, которых нет в прототипе (они улучшают UX)
- **НЕ ТРОГАТЬ** — экраны которых нет в прототипе (NetWorth, InvestTools и т.д.)

---

## ПРИОРИТЕТ 1 — Критичные визуальные расхождения

### 1.1 Dashboard — приветствие и дата перепутаны местами
**Файл:** `screens/DashboardScreen.jsx`
- **Прото:** "Доброе утро" = мелкий 13px gray, дата "Пятница, 14 фев" = крупный 28/700
- **Реализация:** "Доброе утро" = крупный ~26px bold, дата = мелкий 12px gray
- **Исправление:** Поменять местами стили — дата должна быть hero, приветствие мелким

### 1.2 Dashboard — AI Briefing заменён на DailyTipBanner
**Файл:** `screens/DashboardScreen.jsx`
- **Прото:** Карточка AI-брифинга с градиентом (135deg, #007AFF08, #5856D608) + иконка бота + текст
- **Реализация:** Простой DailyTipBanner
- **Исправление:** Вернуть стилизацию брифинга как в прототипе (градиент + бот-иконка)

### 1.3 TabBar — фон не стеклянный
**Файл:** `components/TabBar.jsx`
- **Прото:** Glass morphism — rgba(255,255,255,0.97) + blur(20px)
- **Реализация:** Solid theme.card
- **Исправление:** Добавить backdrop-filter: blur(20px) + полупрозрачный фон

### 1.4 TabBar — иконки используют opacity вместо цвета
**Файл:** `components/TabBar.jsx`
- **Прото:** Активный = blue (#007AFF), неактивный = gray
- **Реализация:** Активный opacity:1, неактивный opacity:0.4
- **Исправление:** Использовать цвет: active=theme.accent, inactive=theme.gray2

### 1.5 TabBar — FAB размер
**Файл:** `components/TabBar.jsx`
- **Прото:** 48×48, r=24, shadow "0 4px 14px rgba(0,122,255,0.4)"
- **Реализация:** 44×44, r=22, без тени
- **Исправление:** Увеличить до 48×48, добавить синюю тень

### 1.6 Quick Add — кнопки все одного цвета
**Файл:** `components/QuickAddSheet.jsx`
- **Прото:** Каждая кнопка имеет свой цвет фона (color+"12" opacity)
- **Реализация:** Все кнопки theme.gray6
- **Исправление:** Назначить каждой кнопке свой цвет по модулю

---

## ПРИОРИТЕТ 2 — Средние визуальные расхождения

### 2.1 Онбординг — 5 шагов вместо 3
**Файл:** `screens/onboarding/OnboardingFlow.jsx`
- **Прото:** 3 шага (Welcome, PIN, AI Chat-style setup)
- **Реализация:** 5 шагов (Welcome, Modules, Profile, Goals, Security)
- **Решение:** ОСТАВИТЬ как есть — расширенный онбординг лучше

### 2.2 Онбординг — PIN вводится в текстовое поле вместо numpad
**Файл:** `screens/onboarding/OnboardingFlow.jsx`
- **Прото:** Визуальный numpad + PIN-точки
- **Реализация:** Обычный password input
- **Решение:** Низкий приоритет, текстовое поле работает нормально на iOS

### 2.3 Finance — Бюджеты без недельного графика
**Файл:** `screens/finance/BudgetsList.jsx`
- **Прото:** Мини-графики "Расходы по неделям" (4 бара) + AI suggestion
- **Реализация:** Нет графиков, нет AI suggestion
- **Исправление:** Добавить 4-барный мини-чарт недельных расходов

### 2.4 Finance — Доход без голосового ввода и заметки
**Файл:** `screens/finance/IncomeForm.jsx`
- **Прото:** Mic button (42×42) рядом с суммой + поле "Заметка"
- **Реализация:** Нет mic, нет заметки
- **Исправление:** Добавить поле "Заметка" (comment/note field)

### 2.5 Sport — Иконка модуля chart→target
**Файл:** `screens/sport/SportOverview.jsx`
- **Прото S1:** Обмеры = icon "chart", цвет orange
- **Реализация:** icon "target"
- **Исправление:** Вернуть icon="chart" для обмеров

### 2.6 Sport — VideoAnalysis: файл вместо камеры
**Файл:** `screens/sport/VideoAnalysis.jsx`
- **Прото S11:** Live camera с тёмным фоном + кнопка записи + pose skeleton
- **Реализация:** File upload в светлом интерфейсе
- **Решение:** ОСТАВИТЬ — полноценная камера требует MediaPipe (план на будущее)

### 2.7 Invest — Иконка брокеров chart→trend
**Файл:** `screens/invest/InvestOverview.jsx`
- **Прото S1:** Иконка для брокерских счетов = "chart" (bar chart)
- **Реализация:** "trend" (ascending line)
- **Исправление:** Вернуть icon="chart" для брокерских счетов

### 2.8 Invest — Показывается daily change вместо P&L
**Файл:** `screens/invest/InvestOverview.jsx`
- **Прото:** Показывает total P&L (b.pnl) для каждого брокера
- **Реализация:** Показывает daily change (b.dailyChange)
- **Исправление:** Показывать P&L (общую прибыль/убыток)

### 2.9 Invest — Иконки импорта
**Файл:** `screens/invest/InvestOverview.jsx`
- **Прото:** upload (не определена) / note (для "вручную")
- **Реализация:** share / edit
- **Решение:** ОСТАВИТЬ — proto имеет баг (upload не определена), impl исправляет

### 2.10 Health — Activity карточка = заглушка
**Файл:** `screens/health/HealthHub.jsx`
- **Прото:** 6 842 шагов · 4.2 км · 312 ккал (реальные данные)
- **Реализация:** "нет данных" заглушка
- **Решение:** ОСТАВИТЬ — нет API для шагов, заглушка корректна

### 2.11 Sleep — Recharts вместо CSS-баров
**Файл:** `screens/more/sleep/SleepScreen.jsx`
- **Прото:** Простые CSS-бары для недельного сна
- **Реализация:** Recharts BarChart
- **Решение:** ОСТАВИТЬ — Recharts лучше выглядит

### 2.12 Routines — плоский список vs группировка
**Файл:** `screens/more/routines/RoutinesList.jsx`
- **Прото:** Плоский список (3 рутины друг за другом)
- **Реализация:** Сгруппированы по типу (morning/household/evening/health)
- **Решение:** ОСТАВИТЬ — группировка более логична

---

## ПРИОРИТЕТ 3 — Мелкие отличия (low priority)

### 3.1 Tasks — Вью-переключатель emoji vs текст
**Файл:** `screens/tasks/TasksList.jsx`
- **Прото:** 2 вида (Список/Канбан) текстовые кнопки
- **Реализация:** 3 вида (☰ 📅 ▦) с emoji-иконками
- **Решение:** ОСТАВИТЬ — 3 вида (включая календарь) полезнее

### 3.2 Tasks — Kanban заголовки
**Файл:** `screens/tasks/TasksList.jsx`
- **Прото:** "СДЕЛАТЬ" (red), "В РАБОТЕ" (orange), "ГОТОВО" (green), uppercase 11/700
- **Реализация:** "К выполнению", "В работе", "Готово", 11/600
- **Исправление:** Поменять на "СДЕЛАТЬ"/"В РАБОТЕ"/"ГОТОВО", fontWeight 700

### 3.3 Tasks — Нет напоминания в деталях
**Файл:** `screens/tasks/TaskDetail.jsx`
- **Прото:** Показывает "Напоминание: 13 фев, 9:00" в карточке свойств
- **Реализация:** Напоминание только в форме редактирования
- **Исправление:** Добавить строку "Напоминание" в properties card

### 3.4 Tasks — Event screen не реализован
- **Прото S4:** Полный модальник создания события (тип, время, место, повтор)
- **Реализация:** Не существует
- **Решение:** Отложить — требует значительной разработки

### 3.5 Notes — Mood widget
**Файл:** `screens/more/notes/NotesList.jsx`
- **Реализация:** Полный I9 виджет настроения (эмодзи + тренд-чарт)
- **Прото:** Нет
- **Решение:** ОСТАВИТЬ — хорошая фича

### 3.6 AI Settings — task-based модели
**Файл:** `screens/settings/AISettings.jsx`
- **Прото:** 4 модели в каскаде (Haiku/Sonnet/Opus/GPT-4o)
- **Реализация:** MODEL_REGISTRY с 8 типами задач
- **Решение:** ОСТАВИТЬ — это PLAN_AI_OVERHAUL, он лучше

### 3.7 Settings — Module count
**Файл:** `screens/settings/SettingsScreen.jsx`
- **Прото:** 7 модулей в Tab Bar customizer
- **Реализация:** 10 модулей
- **Решение:** ОСТАВИТЬ — больше модулей = больше контроля

---

## ПЛАН ИСПРАВЛЕНИЙ С КОДОМ

### FIX 1: Dashboard — приветствие и дата (1.1)

```jsx
// DashboardScreen.jsx — найти секцию приветствия и поменять стили
// БЫЛО:
<div className="text-2xl font-bold">{greeting}</div>  // ~26px bold
<div className="text-xs" style={{ color: theme.gray2 }}>{dateStr}</div>  // 12px

// СТАЛО:
<div style={{ fontSize: 13, color: theme.gray1 }}>{greeting}</div>
<div style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>{dateStr}</div>
```

### FIX 2: TabBar — glass morphism + цвета + FAB (1.3, 1.4, 1.5)

```jsx
// TabBar.jsx — контейнер
// БЫЛО:
background: theme.card

// СТАЛО:
background: 'rgba(255,255,255,0.97)',
backdropFilter: 'blur(20px)',
WebkitBackdropFilter: 'blur(20px)',

// Для тёмной темы:
background: isDark ? 'rgba(28,28,30,0.97)' : 'rgba(255,255,255,0.97)',

// Иконки — БЫЛО: opacity
// СТАЛО: цвет
color: isActive ? theme.accent : theme.gray2

// FAB — БЫЛО: 44×44
// СТАЛО:
width: 48, height: 48, borderRadius: 24,
boxShadow: '0 4px 14px rgba(0,122,255,0.4)',
```

### FIX 3: Quick Add — цветные кнопки (1.6)

```jsx
// QuickAddSheet.jsx — массив кнопок
const ACTIONS = [
  { id: 'expense', label: 'Расход', icon: 'wallet', color: '#34C759' },
  { id: 'income', label: 'Доход', icon: 'trend', color: '#34C759' },
  { id: 'task', label: 'Задача', icon: 'task', color: '#007AFF' },
  { id: 'food', label: 'Еда', icon: 'leaf', color: '#FF9500' },
  { id: 'water', label: 'Вода', icon: 'drop', color: '#007AFF' },
  { id: 'workout', label: 'Трениров.', icon: 'gym', color: '#FF3B30' },
  { id: 'receipt', label: 'Фото чека', icon: 'camera', color: '#FF9500' },
  { id: 'voice', label: 'Голос', icon: 'mic', color: '#FF3B30' },
  { id: 'note', label: 'Заметка', icon: 'edit', color: '#5856D6' },
  { id: 'barcode', label: 'Штрих-код', icon: 'scan', color: '#FF9500' },
  { id: 'routine', label: 'Рутина', icon: 'repeat', color: '#30B0C7' },
  { id: 'sleep', label: 'Сон', icon: 'moon', color: '#5856D6' },
];

// Фон кнопки:
background: action.color + '12'  // 12 = ~7% opacity hex
// Вместо: theme.gray6
```

### FIX 4: Kanban заголовки (3.2)

```jsx
// TasksList.jsx — найти названия колонок канбана
// БЫЛО:
{ id: 'todo', title: 'К выполнению', color: theme.red },
{ id: 'doing', title: 'В работе', color: theme.orange },
{ id: 'done', title: 'Готово', color: theme.green },

// СТАЛО:
{ id: 'todo', title: 'СДЕЛАТЬ', color: theme.red },
{ id: 'doing', title: 'В РАБОТЕ', color: theme.orange },
{ id: 'done', title: 'ГОТОВО', color: theme.green },

// + fontWeight: 700 для заголовков (вместо 600)
```

### FIX 5: Task Detail — показать напоминание (3.3)

```jsx
// TaskDetail.jsx — в секции properties card добавить строку:
{task.reminder_offset != null && (
  <div className="flex items-center justify-between"
    style={{ padding: '12px 14px', borderBottom: `0.5px solid ${theme.gray5}` }}>
    <div className="flex items-center gap-3">
      <Ic name="bell" size={20} color={theme.orange} />
      <span style={{ fontSize: 14, color: theme.gray1 }}>Напоминание</span>
    </div>
    <span style={{ fontSize: 14, color: theme.text }}>
      {formatReminderOffset(task.reminder_offset)}
    </span>
  </div>
)}
```

### FIX 6: Budgets — недельный мини-чарт (2.3)

```jsx
// BudgetsList.jsx — после общего бюджета добавить:
{weeklySpending.length > 0 && (
  <div className="mb-3">
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 8 }}>
      РАСХОДЫ ПО НЕДЕЛЯМ
    </div>
    <Card theme={theme} style={{ padding: 14 }}>
      <div className="flex items-end justify-between" style={{ height: 48, gap: 6 }}>
        {weeklySpending.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div style={{
              width: '100%', borderRadius: 4,
              height: Math.max(4, (w.amount / maxWeek) * 40),
              background: i === weeklySpending.length - 1 ? theme.accent : theme.green + '40',
            }} />
            <span style={{ fontSize: 9, color: theme.gray2 }}>Н{i + 1}</span>
          </div>
        ))}
      </div>
    </Card>
  </div>
)}
```

### FIX 7: Income — поле заметки (2.4)

```jsx
// IncomeForm.jsx — перед кнопкой сохранения добавить:
<div style={{ marginTop: 12 }}>
  <label style={{ fontSize: 12, fontWeight: 600, color: theme.gray1, marginBottom: 6, display: 'block' }}>
    ЗАМЕТКА
  </label>
  <textarea
    value={note}
    onChange={e => setNote(e.target.value)}
    placeholder="Комментарий к записи..."
    style={{
      width: '100%', minHeight: 60, padding: 12, borderRadius: 12,
      border: `1px solid ${theme.gray5}`, background: theme.card,
      color: theme.text, fontSize: 14, resize: 'none',
    }}
  />
</div>
```

### FIX 8: Sport — иконка обмеров (2.5)

```jsx
// SportOverview.jsx — в массиве МОДУЛИ
// БЫЛО:
{ icon: 'target', color: theme.orange, label: 'Обмеры', ... }
// СТАЛО:
{ icon: 'chart', color: theme.orange, label: 'Обмеры', ... }
```

### FIX 9: Invest — иконка брокеров + P&L (2.7, 2.8)

```jsx
// InvestOverview.jsx — секция брокеров
// Иконка БЫЛО: <Ic name="trend" ... />
// СТАЛО: <Ic name="chart" ... />

// P&L БЫЛО: b.dailyChange
// СТАЛО: b.pnl (или b.totalPnl)
```

---

## ЭКРАНЫ ИЗ ПРОТОТИПОВ — СТАТУС

| Экран | Прототип | Файл | Статус |
|-------|----------|------|--------|
| Profile Screen | w14-settings S6 | `screens/settings/ProfileEditor.jsx` (191 строк) | ✅ Реализован |
| Appearance Screen | w14-settings S7 | `screens/settings/AppearanceScreen.jsx` (156 строк) | ✅ Реализован |
| Security Screen | w14-settings S8 | `screens/settings/SecuritySettings.jsx` (336 строк) | ✅ Реализован |
| Data Export Screen | w14-settings S10 | `screens/settings/DataSettings.jsx` (356 строк) | ✅ Реализован |
| About Screen | w14-settings S11 | `screens/settings/AboutScreen.jsx` (82 строки) | ✅ Реализован |
| Analytics Screen | w14-settings S12 | `screens/settings/AnalyticsScreen.jsx` (170 строк) | ✅ Реализован |
| Notifications Screen | w14-settings S13 | `screens/settings/NotificationsScreen.jsx` (124 строки) | ✅ Реализован |
| Calendar Event | w14-tasks S4 | `screens/calendar/EventForm.jsx` (218 строк) | ✅ Реализован |

---

## ФИЧИ РЕАЛИЗАЦИИ КОТОРЫЕ ЛУЧШЕ ПРОТОТИПА (не трогать!)

1. **Tasks:** 3 вида + ChipBar фильтры + productivity card + markdown + comments + attachments
2. **Nutrition:** Weekly analytics + streak tracking + micronutrients + meal presets + goal editing
3. **Sport:** Supersets + cardio exercises + per-exercise rest + exercise notes + PR detection
4. **Sleep:** 30-day trend + bedtime recommendation + sleep debt + interruptions/factors
5. **Notes:** I9 mood tracking + mood trend chart + diary type
6. **AI Settings:** Task-based MODEL_REGISTRY (PLAN_AI_OVERHAUL)
7. **Finance:** Search + date filter + CSV export + pagination in expenses
8. **Subscriptions:** Active/cancelled tabs + due reminders + trial badges + price history
9. **Invest:** NetWorth screen + InvestTools (4 tabs) + tax calculator
10. **Settings:** Dynamic summaries + error logs + analytics navigation

---

## ПОРЯДОК РАБОТЫ

### Батч 1 (Критичные, ~30 мин)
1. ✅ FIX 1: Dashboard greeting/date swap
2. ✅ FIX 2: TabBar glass + colors + FAB
3. ✅ FIX 3: QuickAdd colored buttons

### Батч 2 (Средние, ~20 мин)
4. ✅ FIX 4: Kanban titles
5. ✅ FIX 5: Task reminder in detail
6. ✅ FIX 8: Sport measurements icon
7. ✅ FIX 9: Invest broker icon + P&L

### Батч 3 (Доработки, ~30 мин)
8. ✅ FIX 6: Budget weekly chart
9. ✅ FIX 7: Income note field
