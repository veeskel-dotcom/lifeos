/**
 * GoalForm — создание новой цели.
 */
import { useState } from 'react';
import NavHeader from '../../components/NavHeader';
import { addGoal, GOAL_TYPES } from '../../services/goals';
import FormInput from '../../components/FormInput';
import DatePicker from '../../components/DatePicker';

export default function GoalForm({ theme, onBack }) {
  const [type, setType] = useState(null);
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState({});

  const selectedType = GOAL_TYPES.find(t => t.type === type);

  const handleSave = async () => {
    if (!type) return;
    const e = {};
    const target = parseFloat(targetValue);
    if (!target || target <= 0) e.target = 'Укажите целевое значение';
    if (type === 'custom' && !title.trim()) e.title = 'Укажите название';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    await addGoal({
      type,
      title: type === 'custom' ? title : selectedType?.label,
      target_value: target,
      unit: type === 'custom' ? unit : selectedType?.unit,
      deadline: deadline || null,
    });
    onBack();
  };

  // Step 1: Выбор типа
  if (!type) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
        <NavHeader title="Новая цель" onBack={onBack} theme={theme} />
        <div className="px-4 pt-2 space-y-2">
          {GOAL_TYPES.map(gt => (
            <button key={gt.type} onClick={() => { setType(gt.type); setUnit(gt.unit); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left"
              style={{ background: theme.card, border: 'none', cursor: 'pointer' }}>
              <span className="text-2xl">{gt.icon}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: theme.text }}>{gt.label}</div>
                {gt.unit && <div className="text-[10px]" style={{ color: theme.gray2 }}>{gt.unit}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Настройка
  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title={selectedType?.label || 'Цель'} onBack={() => setType(null)} theme={theme} />

      <div className="px-4 pt-4 space-y-4">
        <div className="text-center text-5xl mb-2">{selectedType?.icon || '🎯'}</div>

        {type === 'custom' && (
          <div>
            <FormInput value={title} onChange={setTitle} placeholder="Название цели" autoFocus theme={theme} />
            {errors.title && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.title}</p>}
          </div>
        )}

        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: theme.gray1 }}>
            Целевое значение
          </label>
          <div className="flex gap-2">
            <FormInput type="number" inputMode="decimal" value={targetValue} onChange={setTargetValue} placeholder="0" autoFocus theme={theme} />
            {type === 'custom' ? (
              <FormInput value={unit} onChange={setUnit} placeholder="ед." theme={theme} />
            ) : (
              <div className="flex items-center px-3 rounded-xl text-sm"
                style={{ background: theme.gray6, color: theme.gray1 }}>
                {selectedType?.unit}
              </div>
            )}
          </div>
          {errors.target && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.target}</p>}
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: theme.gray1 }}>
            Дедлайн (опционально)
          </label>
          <div onClick={() => setShowDeadlinePicker(true)}
            className="w-full px-4 py-3 rounded-xl text-sm cursor-pointer"
            style={{ background: theme.card, color: deadline ? theme.text : theme.gray3 }}>
            {deadline || 'Выберите дату'}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!targetValue || parseFloat(targetValue) <= 0}
          className="w-full py-3.5 rounded-xl font-semibold text-base"
          style={{
            background: (!targetValue || parseFloat(targetValue) <= 0) ? theme.gray4 : theme.accent,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Создать цель
        </button>
      </div>

      <DatePicker open={showDeadlinePicker} onClose={() => setShowDeadlinePicker(false)} value={deadline} onChange={setDeadline} theme={theme} />
    </div>
  );
}
