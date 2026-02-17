/**
 * D3.2: Фото прогресса — таймлайн фото (спереди / сбоку / сзади)
 */
import { useState, useEffect, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import Card from '../../components/Card';
import ChipBar from '../../components/ChipBar';
import EmptyState from '../../components/EmptyState';
import LazyImage from '../../components/LazyImage';
import ConfirmSheet from '../../components/ConfirmSheet';
import {
  addPhoto, getPhotos, deletePhoto, PHOTO_CATEGORIES,
} from '../../services/progressPhotos';

const CAT_LABELS = { front: 'Спереди', side: 'Сбоку', back: 'Сзади' };

export default function ProgressPhotos({ theme, onBack }) {
  const [photos, setPhotos] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [viewPhoto, setViewPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileRef = useRef();

  const load = () => {
    const opts = activeTab !== 'all' ? { category: activeTab } : {};
    getPhotos(opts).then(setPhotos);
  };

  useEffect(load, [activeTab]);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // Resize to max 800px to save space
      const img = new Image();
      img.onload = async () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        await addPhoto(new Date().toISOString().slice(0, 10), activeTab !== 'all' ? activeTab : 'front', dataUrl);
        load();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deletePhoto(deleteTarget);
      setDeleteTarget(null);
      setViewPhoto(null);
      load();
    }
  };

  const tabs = [
    { key: 'all', label: 'Все' },
    ...PHOTO_CATEGORIES.map(c => ({ key: c, label: CAT_LABELS[c] })),
  ];

  // Group photos by date
  const grouped = photos.reduce((acc, p) => {
    if (!acc[p.date]) acc[p.date] = [];
    acc[p.date].push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col min-h-screen" style={{ background: theme.bg }}>
      <NavHeader title="Фото прогресса" onBack={onBack} left theme={theme} />

      <div className="px-4 pt-1 pb-2">
        <ChipBar
          items={tabs}
          active={activeTab}
          onChange={setActiveTab}
          theme={theme}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {photos.length === 0 ? (
          <EmptyState
            icon="📸"
            title="Нет фото"
            subtitle="Добавьте фото для отслеживания прогресса"
            theme={theme}
          />
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="mb-2" style={{ color: theme.gray2, fontSize: 12, fontWeight: 500 }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setViewPhoto(p)}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer"
                    style={{ background: theme.gray5 }}
                  >
                    <LazyImage
                      src={p.data}
                      alt={CAT_LABELS[p.category]}
                      className="w-full h-full"
                      style={{ objectFit: 'cover' }}
                      placeholder={theme.gray5}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 py-1" style={{ textAlign: 'center', fontSize: 10, fontWeight: 500, background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                    >
                      {CAT_LABELS[p.category]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB — Camera */}
      <button
        onClick={() => fileRef.current?.click()}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: theme.accent, color: '#fff', border: 'none', fontSize: 24, zIndex: 50 }}
      >
        📷
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Full-screen viewer */}
      {viewPhoto && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: '#000' }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setViewPhoto(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 500 }}>
              ← Назад
            </button>
            <span style={{ color: '#fff', fontSize: 14 }}>
              {CAT_LABELS[viewPhoto.category]} · {viewPhoto.date}
            </span>
            <button onClick={() => setDeleteTarget(viewPhoto.id)} style={{ color: '#ff3b30', background: 'none', border: 'none', fontSize: 14 }}>
              Удалить
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={viewPhoto.data} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить фото?"
        message="Фото будет удалено навсегда"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        theme={theme}
      />
    </div>
  );
}
