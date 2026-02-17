/**
 * FoodManualEntry — Ручной ввод КБЖУ продукта.
 */
import { useState } from 'react';
import NavHeader from '../../components/NavHeader';
import { addManualProduct } from '../../services/products';
import { addMeal } from '../../services/nutrition';
import IOSKeyboardSpacer from '../../components/IOSKeyboardSpacer';
import ScreenWrapper from '../../components/ScreenWrapper';
import FormInput from '../../components/FormInput';

export default function FoodManualEntry({ meal, date, theme, onBack }) {
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [prot, setProt] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [grams, setGrams] = useState('100');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && cal;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      // Сохранить в кэш продуктов
      const product = await addManualProduct({
        name: name.trim(),
        calories_100: parseFloat(cal) || 0,
        protein_100: parseFloat(prot) || 0,
        fat_100: parseFloat(fat) || 0,
        carbs_100: parseFloat(carbs) || 0,
      });

      // Добавить в дневник
      const g = parseInt(grams) || 100;
      const factor = g / 100;
      await addMeal(date, meal, [{
        product_id: product.id,
        name: product.name,
        amount_g: g,
        calories: Math.round(product.calories_100 * factor),
        protein: Math.round(product.protein_100 * factor * 10) / 10,
        fat: Math.round(product.fat_100 * factor * 10) / 10,
        carbs: Math.round(product.carbs_100 * factor * 10) / 10,
      }]);

      onBack?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper theme={theme}>
      <NavHeader title="Ручной ввод" onBack={onBack} theme={theme} />

      <div className="px-4 space-y-4 pt-2">
        {/* Название */}
        <div className="rounded-2xl p-4" style={{ background: theme.card }}>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.gray1 }}>
            Название продукта
          </label>
          <FormInput value={name} onChange={setName} placeholder="Гречка варёная" theme={theme} />
        </div>

        {/* КБЖУ на 100г */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: theme.card }}>
          <div className="text-xs font-medium" style={{ color: theme.gray1 }}>
            КБЖУ на 100г
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Калории" value={cal} onChange={setCal} suffix="ккал" theme={theme} />
            <Field label="Белки" value={prot} onChange={setProt} suffix="г" theme={theme} />
            <Field label="Жиры" value={fat} onChange={setFat} suffix="г" theme={theme} />
            <Field label="Углеводы" value={carbs} onChange={setCarbs} suffix="г" theme={theme} />
          </div>
        </div>

        {/* Порция */}
        <div className="rounded-2xl p-4" style={{ background: theme.card }}>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.gray1 }}>
            Порция (г)
          </label>
          <FormInput type="number" inputMode="numeric" value={grams} onChange={setGrams} theme={theme} />
        </div>

        {/* Итого */}
        {cal && (
          <div className="text-center text-sm py-2" style={{ color: theme.gray1 }}>
            = {Math.round((parseFloat(cal) || 0) * (parseInt(grams) || 100) / 100)} ккал за порцию
          </div>
        )}

        {/* Кнопка */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3.5 rounded-xl text-base font-semibold"
          style={{
            background: canSave ? theme.accent : theme.gray4,
            color: '#fff', border: 'none',
            cursor: canSave ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Сохраняю...' : 'Добавить'}
        </button>
      </div>
    </ScreenWrapper>
  );
}

function Field({ label, value, onChange, suffix, theme }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: theme.gray2 }}>{label}</label>
      <div className="flex items-center gap-1">
        <FormInput type="number" inputMode="decimal" value={value} onChange={onChange} placeholder="0" theme={theme} />
        <span className="text-xs shrink-0" style={{ color: theme.gray2 }}>{suffix}</span>
      </div>
      <IOSKeyboardSpacer />
    </div>
  );
}
