import { useState, useRef, useEffect, useCallback } from 'react';
import db from '../db/index';
import { processInput } from '../ai/index';
import VoiceInput from './VoiceInput';
import { haptic } from '../utils/ios';
import { getCurrencyCode } from '../utils/currency';
import Ic from './Icon';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * QuickAddSheet — Bottom Sheet от ＋ кнопки TabBar.
 * 6 кнопок быстрого действия + AI текстовое поле.
 * @param {boolean} open
 * @param {function} onClose
 * @param {function} onNavigate
 * @param {object} theme
 * @param {function} onToast - показать toast
 */
export default function QuickAddSheet({ open, onClose, onNavigate, theme, onToast }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const backdropRef = useRef(null);

  // Закрытие по тапу на backdrop
  const handleBackdrop = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  // Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const actions = [
    { iconName: 'wallet', color: theme.green || '#34C759', label: 'Расход', action: () => { haptic('light'); onClose(); onNavigate?.('expense-form'); } },
    { iconName: 'money', color: theme.accent || '#007AFF', label: 'Доход', action: () => { haptic('light'); onClose(); onNavigate?.('income-form'); } },
    { iconName: 'task', color: theme.orange || '#FF9500', label: 'Задача', action: () => { haptic('light'); onClose(); onNavigate?.('task-form'); } },
    { iconName: 'leaf', color: theme.green || '#34C759', label: 'Еда', action: () => { haptic('light'); onClose(); onNavigate?.('food-search'); } },
    {
      iconName: 'drop', color: theme.teal || '#30B0C7', label: 'Вода', action: async () => {
        const today = new Date().toISOString().slice(0, 10);
        await db.water_log.add({ date: today, amount_ml: 250, ts: Date.now() });
        haptic('success');
        onToast?.('💧 +250 мл воды');
        onClose();
      }
    },
    /* O1: Тренировка */
    { iconName: 'gym', color: theme.red || '#FF3B30', label: 'Тренировка', action: () => { haptic('light'); onClose(); onNavigate?.('active-workout'); } },
    /* O2: Заметка */
    { iconName: 'note', color: '#FFCC00', label: 'Заметка', action: () => { haptic('light'); onClose(); onNavigate?.('note-editor'); } },
    {
      iconName: 'camera', color: theme.orange || '#FF9500', label: 'Фото', action: () => {
        haptic('light');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onClose();
          onToast?.('📸 Распознаю...');
          try {
            const base64 = await fileToBase64(file);
            const { autoParseImage } = await import('../services/ocr');
            const result = await autoParseImage(base64);

            if (result.error || !result.data) {
              haptic('error');
              onToast?.(`⚠️ Не удалось распознать: ${result.error || 'неизвестный формат'}`);
              return;
            }

            haptic('success');

            if (result.type === 'receipt') {
              const d = result.data;
              const today = new Date().toISOString().slice(0, 10);
              for (const item of (d.items || [])) {
                await db.expenses.add({
                  amount: item.price || 0,
                  category_path_snapshot: d.store || 'Чек',
                  comment: item.name,
                  date: d.date || today,
                  time: new Date().toTimeString().slice(0, 5),
                  currency: getCurrencyCode(),
                  ts: Date.now(),
                });
              }
              onToast?.(`✅ Чек: ${d.items?.length || 0} позиций, ${d.total || '?'}₸`);

            } else if (result.type === 'bank_statement') {
              let added = 0;
              for (const op of result.data) {
                if (op.type === 'expense') {
                  await db.expenses.add({
                    amount: Math.abs(op.amount),
                    comment: op.description,
                    date: op.date || new Date().toISOString().slice(0, 10),
                    time: new Date().toTimeString().slice(0, 5),
                    currency: getCurrencyCode(),
                    ts: Date.now(),
                  });
                } else {
                  await db.incomes.add({
                    amount: Math.abs(op.amount),
                    source: op.description,
                    date: op.date || new Date().toISOString().slice(0, 10),
                    currency: getCurrencyCode(),
                    ts: Date.now(),
                  });
                }
                added++;
              }
              onToast?.(`✅ Выписка: ${added} операций добавлено`);

            } else if (result.type === 'credit_doc') {
              const c = result.data;
              await db.credits.add({
                name: c.name || 'Кредит',
                bank: c.bank || '',
                type: c.type || 'consumer',
                original_amount: c.original_amount || 0,
                current_balance: c.original_amount || 0,
                interest_rate: c.interest_rate || 0,
                monthly_payment: c.monthly_payment || 0,
                start_date: c.start_date,
                end_date: c.end_date,
                currency: getCurrencyCode(),
                ts: Date.now(),
              });
              onToast?.(`✅ Кредит: ${c.name || c.bank || 'добавлен'}`);
            }
          } catch (err) {
            haptic('error');
            const msg = err.message?.includes('API_KEY_MISSING')
              ? 'Нужен API-ключ (Настройки → AI)'
              : err.message?.includes('LIMIT_REACHED')
              ? 'Лимит AI исчерпан'
              : `Ошибка: ${err.message}`;
            onToast?.(`⚠️ ${msg}`);
          }
        };
        input.click();
      }
    },
    /* Proto S1: Голос */
    { iconName: 'mic', color: theme.purple || '#AF52DE', label: 'Голос', action: () => { haptic('light'); onClose(); onNavigate?.('voice-input'); } },
    /* Proto S1: Штрих-код */
    { iconName: 'barcode', color: theme.gray1 || '#8E8E93', label: 'Штрих-код', action: () => { haptic('light'); onClose(); onNavigate?.('barcode-scanner'); } },
    /* Proto S1: Рутина */
    { iconName: 'repeat', color: theme.teal || '#30B0C7', label: 'Рутина', action: () => { haptic('light'); onClose(); onNavigate?.('routines'); } },
    /* Proto S1: Сон */
    { iconName: 'moon', color: theme.purple || '#AF52DE', label: 'Сон', action: () => { haptic('light'); onClose(); onNavigate?.('sleep-add'); } },
  ];

  // AI текстовый ввод
  const handleSubmitText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');

    try {
      const result = await processInput(trimmed);

      if (result.error) {
        haptic('error');
        onToast?.(`⚠️ ${result.message || 'Ошибка AI'}`);
      } else if (result.action === 'add_expense') {
        const today = new Date().toISOString().split('T')[0];
        await db.expenses.add({
          amount: result.params.amount,
          description: result.params.description,
          category_id: null,
          account_id: null,
          date: today,
          time: new Date().toTimeString().slice(0, 5),
          ts: Date.now(),
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_transfer') {
        const today = new Date().toISOString().split('T')[0];
        await db.expenses.add({
          amount: result.params.amount,
          description: result.params.description || 'Перевод',
          category_id: null,
          account_id: null,
          date: today,
          time: new Date().toTimeString().slice(0, 5),
          ts: Date.now(),
          is_transfer: true,
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_income') {
        const today = new Date().toISOString().split('T')[0];
        await db.incomes.add({ amount: result.params.amount, source: result.params.source || 'Прочее', date: today, ts: Date.now() });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'log_water') {
        const today = new Date().toISOString().split('T')[0];
        await db.water_log.add({ date: today, amount_ml: result.params.amount_ml, ts: Date.now() });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'log_weight') {
        const today = new Date().toISOString().split('T')[0];
        await db.body_weight.add({ date: today, weight: result.params.weight_kg, ts: Date.now() });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_task') {
        await db.tasks.add({
          title: result.params.title,
          status: 'active',
          priority: result.params.priority || 'normal',
          deadline: null,
          created_at: new Date().toISOString(),
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_routine') {
        await db.routines.add({
          name: result.params.name,
          type: result.params.type || 'morning',
          frequency: result.params.frequency || 'daily',
          streak: 0,
          best_streak: 0,
          is_active: true,
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_note') {
        await db.notes.add({
          content: result.params.content,
          tags: [],
          created_at: new Date().toISOString(),
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'add_food') {
        const today = new Date().toISOString().split('T')[0];
        await db.food_log.add({
          date: today,
          meal_type: result.params.meal || 'lunch',
          items: [{ name: result.params.description, amount_g: 100 }],
          total_calories: result.params.calories || 0,
          total_protein: 0,
          total_fat: 0,
          total_carbs: 0,
          ts: Date.now(),
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'log_sleep') {
        const today = new Date().toISOString().split('T')[0];
        await db.sleep_log.add({
          date: today,
          bed_time: result.params.bed_time || null,
          wake_time: result.params.wake_time || null,
          duration_hours: result.params.duration_hours || null,
          ts: Date.now(),
        });
        haptic('success');
        onToast?.(result.message);
      } else if (result.action === 'navigate') {
        haptic('light');
        onNavigate?.(result.params.screen);
      } else if (result.message) {
        haptic('success');
        onToast?.(result.message);
      }
    } catch (e) {
      console.error('AI error:', e);
      haptic('error');
      onToast?.('⚠️ Ошибка обработки');
    }

    onClose();
  }, [text, onToast, onClose, onNavigate]);

  // Голосовой результат — обрабатывается тем же путём что и текст
  const handleVoiceResult = useCallback(async (voiceText) => {
    setText('');
    try {
      const result = await processInput(voiceText);
      // Используем тот же обработчик что и для текста
      const fakeEvent = { target: { value: '' } };
      // Прямой вызов обработки
      if (result.action === 'navigate') {
        haptic('light');
        onNavigate?.(result.params.screen);
      } else if (['add_expense','add_transfer','add_income','log_water','log_weight','add_task','add_routine','add_note','add_food','log_sleep'].includes(result.action)) {
        // Записать в БД
        const today = new Date().toISOString().split('T')[0];
        const now = Date.now();
        const actions = {
          add_expense: () => db.expenses.add({ amount: result.params.amount, description: result.params.description, category_id: null, account_id: null, date: today, time: new Date().toTimeString().slice(0, 5), ts: now }),
          add_transfer: () => db.expenses.add({ amount: result.params.amount, description: result.params.description || 'Перевод', category_id: null, account_id: null, date: today, time: new Date().toTimeString().slice(0, 5), ts: now, is_transfer: true }),
          add_income: () => db.incomes.add({ amount: result.params.amount, source: result.params.source || 'Прочее', date: today, ts: now }),
          log_water: () => db.water_log.add({ date: today, amount_ml: result.params.amount_ml, ts: now }),
          log_weight: () => db.body_weight.add({ date: today, weight: result.params.weight_kg, ts: now }),
          add_task: () => db.tasks.add({ title: result.params.title, status: 'active', priority: result.params.priority || 'normal', deadline: null, created_at: new Date().toISOString() }),
          add_routine: () => db.routines.add({ name: result.params.name, type: result.params.type || 'morning', frequency: result.params.frequency || 'daily', streak: 0, best_streak: 0, is_active: true }),
          add_note: () => db.notes.add({ content: result.params.content, tags: [], created_at: new Date().toISOString() }),
          add_food: () => db.food_log.add({ date: today, meal_type: result.params.meal || 'lunch', items: [{ name: result.params.description, amount_g: 100 }], total_calories: result.params.calories || 0, total_protein: 0, total_fat: 0, total_carbs: 0, ts: now }),
          log_sleep: () => db.sleep_log.add({ date: today, bed_time: result.params.bed_time || null, wake_time: result.params.wake_time || null, duration_hours: result.params.duration_hours || null, ts: now }),
        };
        await actions[result.action]();
        haptic('success');
        onToast?.(result.message || `🎤 Записано`);
      } else {
        haptic('success');
        onToast?.(result.message || `🎤 «${voiceText}»`);
      }
    } catch (e) {
      haptic('error');
      onToast?.(`🎤 «${voiceText}» — ошибка`);
    }
    onClose();
  }, [onToast, onClose, onNavigate]);

  const sheetRef = useRef(null);
  const touchStart = useRef(null);
  const touchDelta = useRef(0);

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientY;
    touchDelta.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStart.current === null) return;
    const dy = e.touches[0].clientY - touchStart.current;
    touchDelta.current = dy;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.25s ease';
      if (touchDelta.current > 80) {
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => onClose(), 200);
      } else {
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    touchStart.current = null;
    touchDelta.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-md rounded-t-3xl px-6 pt-3 animate-slide-up"
        style={{
          background: theme.card,
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: theme.gray3 }} />
        </div>

        <h2 className="text-base font-semibold mb-4" style={{ color: theme.text }}>
          Быстрое добавление
        </h2>

        {/* 6 кнопок — 3x2 grid */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-transform active:scale-95"
              style={{ background: a.color + '12' }}
            >
              <Ic name={a.iconName} color={a.color} size={52} r={16} />
              <span className="text-xs font-medium" style={{ color: theme.text }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        {/* AI текстовое поле + голос */}
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: theme.gray6 }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitText(); }}
            placeholder="🎤 Скажите или напишите..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: theme.text }}
          />
          {text ? (
            <button
              onClick={handleSubmitText}
              className="text-sm font-semibold"
              style={{ color: theme.accent }}
            >
              →
            </button>
          ) : (
            <VoiceInput onResult={handleVoiceResult} theme={theme} />
          )}
        </div>
      </div>
    </div>
  );
}
