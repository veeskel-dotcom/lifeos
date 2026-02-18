import { useState, useRef, useCallback } from 'react';
import { searchByBarcode, scanBarcode } from '../../services/nutrition';
import ProgressBar from '../../components/ProgressBar';

export default function BarcodeScanner({ onClose, onProductFound, theme }) {
  const [status, setStatus] = useState('idle'); // idle | scanning | found | error
  const [product, setProduct] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [grams, setGrams] = useState('100');
  const fileRef = useRef(null);

  const handleCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('scanning');
    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      const code = await scanBarcode(base64);
      if (code) {
        setBarcode(code);
        const prod = await searchByBarcode(code);
        if (prod) {
          setProduct(prod);
          setStatus('found');
        } else {
          setStatus('error');
        }
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('Barcode scan failed:', err);
      setStatus('error');
    }
  }, []);

  const handleAdd = useCallback(() => {
    if (!product) return;
    const g = parseFloat(grams) || 100;
    const ratio = g / 100;
    onProductFound?.({
      ...product,
      grams: g,
      calories: Math.round((product.calories_100 || product.calories || 0) * ratio),
      protein: parseFloat(((product.protein_100 || product.protein || 0) * ratio).toFixed(1)),
      fat: parseFloat(((product.fat_100 || product.fat || 0) * ratio).toFixed(1)),
      carbs: parseFloat(((product.carbs_100 || product.carbs || 0) * ratio).toFixed(1)),
    });
  }, [product, grams, onProductFound]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)' }}>

      {/* Top bar */}
      <div className="absolute top-12 left-0 right-0 z-10 px-4 flex justify-between items-center">
        <button className="text-white text-2xl font-light w-8" onClick={onClose}>‹</button>
        <span className="text-white text-lg font-semibold">Сканер</span>
        <div className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)' }}>
          <span className="text-white text-sm">⚡</span>
        </div>
      </div>

      {/* Scanning frame */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ width: 240, height: 160 }}>
        {/* Corner brackets */}
        {[
          { top: 0, left: 0, borderTop: '3px solid #fff', borderLeft: '3px solid #fff' },
          { top: 0, right: 0, borderTop: '3px solid #fff', borderRight: '3px solid #fff' },
          { bottom: 0, left: 0, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff' },
          { bottom: 0, right: 0, borderBottom: '3px solid #fff', borderRight: '3px solid #fff' },
        ].map((s, i) => (
          <div key={i} className="absolute rounded" style={{ width: 28, height: 28, ...s }} />
        ))}
        {/* Scan line */}
        {status === 'scanning' && (
          <div className="absolute left-2.5 right-2.5 h-0.5 rounded-sm opacity-80 animate-pulse"
            style={{ top: '45%', background: theme.green }} />
        )}
      </div>

      {/* Instruction */}
      <div className="absolute z-10 left-0 right-0 text-center" style={{ top: '70%' }}>
        {status === 'idle' && (
          <>
            <div className="text-white text-base font-medium">Наведите камеру на штрих-код</div>
            <div className="text-white/50 text-xs mt-1">Продукт определится автоматически</div>
            <button
              className="mt-4 px-6 py-3 rounded-xl text-base font-semibold text-white"
              style={{ background: theme.accent }}
              onClick={() => fileRef.current?.click()}>
              📷 Сфотографировать
            </button>
          </>
        )}
        {status === 'scanning' && (
          <div className="text-white text-base font-medium">Распознаю...</div>
        )}
        {status === 'error' && (
          <>
            <div className="text-white text-base font-medium">Не удалось распознать</div>
            <button
              className="mt-3 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: theme.accent }}
              onClick={() => { setStatus('idle'); fileRef.current?.click(); }}>
              Попробовать снова
            </button>
          </>
        )}
      </div>

      {/* Result card */}
      {status === 'found' && product && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-8"
          style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, background: theme.card, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' }}>
          {/* Handle */}
          <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ background: theme.gray3 }} />

          {/* Found status */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-2 h-2 rounded-full" style={{ background: theme.green }} />
            <span className="text-xs font-medium" style={{ color: theme.green }}>Продукт найден</span>
            {barcode && (
              <span className="text-xs ml-auto" style={{ color: theme.gray3 }}>EAN: {barcode}</span>
            )}
          </div>

          {/* Product info */}
          <div className="flex gap-3 mb-3">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
              style={{ background: theme.gray5 }}>
              {product.emoji || '🍽'}
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold" style={{ color: theme.text }}>{product.name}</div>
              {product.brand && (
                <div className="text-sm" style={{ color: theme.gray2 }}>{product.brand}</div>
              )}
              <div className="flex gap-2 mt-1 text-xs">
                <span className="font-semibold" style={{ color: theme.orange }}>
                  {product.calories_100 || product.calories} ккал
                </span>
                <span style={{ color: theme.gray2 }}>
                  Б <b style={{ color: theme.red }}>{product.protein_100 || product.protein}</b>
                </span>
                <span style={{ color: theme.gray2 }}>
                  Ж <b style={{ color: '#FFCC00' }}>{product.fat_100 || product.fat}</b>
                </span>
                <span style={{ color: theme.gray2 }}>
                  У <b style={{ color: theme.accent }}>{product.carbs_100 || product.carbs}</b>
                </span>
                <span style={{ color: theme.gray3 }}>/100 г</span>
              </div>
            </div>
          </div>

          {/* Grams input */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm" style={{ color: theme.gray1 }}>Количество:</span>
            <div className="flex items-center rounded-xl px-3 py-2" style={{ background: theme.gray6 || theme.bg }}>
              <input
                type="number"
                inputMode="numeric"
                value={grams}
                onChange={e => setGrams(e.target.value)}
                className="w-16 bg-transparent outline-none text-sm font-semibold text-right"
                style={{ color: theme.text }}
              />
              <span className="text-sm ml-1" style={{ color: theme.gray2 }}>г</span>
            </div>
            {/* Quick amounts */}
            {[50, 100, 150, 200].map(g => (
              <button key={g} className="px-2 py-1 rounded-lg text-xs font-medium"
                style={{
                  background: grams === String(g) ? theme.accent + '15' : theme.gray5,
                  color: grams === String(g) ? theme.accent : theme.gray2,
                }}
                onClick={() => setGrams(String(g))}>
                {g}
              </button>
            ))}
          </div>

          {/* Total for portion */}
          {(() => {
            const g = parseFloat(grams) || 100;
            const r = g / 100;
            const cal = Math.round((product.calories_100 || product.calories || 0) * r);
            const prot = ((product.protein_100 || product.protein || 0) * r).toFixed(1);
            const fat = ((product.fat_100 || product.fat || 0) * r).toFixed(1);
            const carb = ((product.carbs_100 || product.carbs || 0) * r).toFixed(1);
            return (
              <div className="flex justify-around py-2 mb-3"
                style={{ borderTop: `0.5px solid ${theme.gray5}`, borderBottom: `0.5px solid ${theme.gray5}` }}>
                {[
                  { v: cal, l: 'ккал', c: theme.orange },
                  { v: prot, l: 'белки', c: theme.red },
                  { v: fat, l: 'жиры', c: '#FFCC00' },
                  { v: carb, l: 'углев.', c: theme.accent },
                ].map(n => (
                  <div key={n.l} className="text-center">
                    <div className="text-base font-bold tabular-nums" style={{ color: n.c }}>{n.v}</div>
                    <div className="text-[10px]" style={{ color: theme.gray2 }}>{n.l}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Add button */}
          <button
            className="w-full py-3.5 rounded-xl text-white text-base font-semibold"
            style={{ background: theme.green }}
            onClick={handleAdd}>
            Добавить
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleCapture} />
    </div>
  );
}
