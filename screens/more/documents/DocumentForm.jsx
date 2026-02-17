import { useState } from 'react';
import Card from '../../../components/Card';
import NavHeader from '../../../components/NavHeader';
import { addDocument, updateDocument } from '../../../services/documents';
import IOSKeyboardSpacer from '../../../components/IOSKeyboardSpacer';
import FormInput from '../../../components/FormInput';
import DatePicker from '../../../components/DatePicker';

const DOC_TYPES = [
  { v: 'passport', l: '🪪 Паспорт' },
  { v: 'passport_intl', l: '🪪 Загранпаспорт' },
  { v: 'driver', l: '🪪 Права' },
  { v: 'insurance', l: '🛡️ Страховка' },
  { v: 'car_insurance', l: '🚗 ОСАГО/КАСКО' },
  { v: 'medical', l: '💊 Медполис' },
  { v: 'visa', l: '✈️ Виза' },
  { v: 'contract', l: '📄 Контракт' },
  { v: 'other', l: '📋 Другое' },
];

export default function DocumentForm({ theme, onBack, onSave, existing }) {
  const [name, setName] = useState(existing?.name || '');
  const [type, setType] = useState(existing?.type || 'passport');
  const [number, setNumber] = useState(existing?.number || '');
  const [issuedAt, setIssuedAt] = useState(existing?.issued_at || '');
  const [showIssuedPicker, setShowIssuedPicker] = useState(false);
  const [expiresAt, setExpiresAt] = useState(existing?.expires_at || '');
  const [showExpiresPicker, setShowExpiresPicker] = useState(false);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [remindDays, setRemindDays] = useState(existing?.remind_before_days?.toString() || '30');
  const [photo, setPhoto] = useState(existing?.photo_blob || null);
  const [errors, setErrors] = useState({});

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const e = {};
    if (!name.trim()) e.name = 'Введите название';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    const data = {
      name: name.trim(), type, number: number || null,
      issued_at: issuedAt || null, expires_at: expiresAt || null,
      notes: notes || null, remind_before_days: parseInt(remindDays) || 30,
      photo_blob: photo,
    };
    if (existing?.id) {
      await updateDocument(existing.id, data);
    } else {
      await addDocument(data);
    }
    onSave?.();
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-28">
      <NavHeader
        title={existing ? 'Редактировать' : 'Новый документ'}
        onBack={onBack}
        theme={theme}
        rightAction={{ label: 'Готово', onClick: handleSave }}
      />

      <Card theme={theme}>
        <FormInput value={name} onChange={setName} placeholder="Название документа" theme={theme} />
        {errors.name && <p className="text-xs mt-1" style={{ color: theme.red }}>{errors.name}</p>}

        {/* Тип */}
        <p className="text-xs mb-1" style={{ color: theme.gray1 }}>Тип</p>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {DOC_TYPES.map(t => (
            <button
              key={t.v}
              onClick={() => setType(t.v)}
              className="px-2.5 py-1.5 rounded-xl text-xs"
              style={{
                background: type === t.v ? theme.accent : theme.gray6,
                color: type === t.v ? '#fff' : theme.text,
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Номер */}
        <p className="text-xs mb-1" style={{ color: theme.gray1 }}>Номер (необязательно)</p>
        <FormInput value={number} onChange={setNumber} placeholder="***1234" theme={theme} />

        {/* Даты */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: theme.gray1 }}>Выдан</p>
            <div onClick={() => setShowIssuedPicker(true)}
              className="w-full rounded-xl px-3 py-2.5 text-sm cursor-pointer"
              style={{ background: theme.card, color: issuedAt ? theme.text : theme.gray3 }}>
              {issuedAt || 'Выбрать'}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: theme.gray1 }}>Истекает</p>
            <div onClick={() => setShowExpiresPicker(true)}
              className="w-full rounded-xl px-3 py-2.5 text-sm cursor-pointer"
              style={{ background: theme.card, color: expiresAt ? theme.text : theme.gray3 }}>
              {expiresAt || 'Выбрать'}
            </div>
          </div>
        </div>

        {/* Напоминание */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs" style={{ color: theme.gray1 }}>Напомнить за</span>
          <FormInput type="number" value={remindDays} onChange={setRemindDays} theme={theme} />
          <span className="text-xs" style={{ color: theme.gray1 }}>дней</span>
        </div>

        {/* Заметки */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Заметки..."
          className="w-full min-h-16 text-sm bg-transparent outline-none resize-none mb-3"
          style={{ color: theme.text }}
        />

        {/* J2: Фото документа — камера + галерея + удаление */}
        <div>
          <p className="text-xs mb-1" style={{ color: theme.gray1 }}>Фото документа</p>
          {photo && (
            <div className="relative mb-2">
              <img src={photo} alt="" className="w-full h-40 object-cover rounded-xl" loading="lazy" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1 py-2.5 rounded-xl text-sm text-center cursor-pointer"
              style={{ background: theme.gray6, color: theme.text }}>
              📷 Камера
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            </label>
            <label className="flex-1 py-2.5 rounded-xl text-sm text-center cursor-pointer"
              style={{ background: theme.gray6, color: theme.text }}>
              🖼 Галерея
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          </div>
        </div>
      </Card>
      <DatePicker open={showIssuedPicker} onClose={() => setShowIssuedPicker(false)} value={issuedAt} onChange={setIssuedAt} theme={theme} />
      <DatePicker open={showExpiresPicker} onClose={() => setShowExpiresPicker(false)} value={expiresAt} onChange={setExpiresAt} theme={theme} />
      <IOSKeyboardSpacer />
    </div>
  );
}
