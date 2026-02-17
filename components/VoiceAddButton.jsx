import { useState, useRef, useCallback } from 'react';
import { isVoiceSupported, startListening } from '../ai/voice';

/**
 * VoiceAddButton — компактная кнопка 🎤 для экранов со списками.
 * Рядом с кнопкой «+ Добавить». Передаёт распознанный текст в onResult.
 * @param {function} onResult - (text) => void
 * @param {object} theme
 * @param {string} hint - подсказка (напр. "Скажите название рутины")
 */
export default function VoiceAddButton({ onResult, theme, hint }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);

  const supported = isVoiceSupported();
  if (!supported) return null;

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      setInterim('');
      return;
    }

    setListening(true);
    recognitionRef.current = startListening(
      ({ final, interim: interimText, isFinal }) => {
        setInterim(interimText);
        if (isFinal && final) {
          onResult?.(final);
          setInterim('');
        }
      },
      () => { setListening(false); setInterim(''); },
      (finalText) => {
        setListening(false);
        if (finalText) onResult?.(finalText);
        setInterim('');
      }
    );
  }, [listening, onResult]);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        className="w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-90"
        style={{
          background: listening ? theme.red : theme.gray5,
          color: listening ? '#fff' : theme.text,
          boxShadow: listening ? `0 0 0 4px ${theme.red}33` : 'none',
          animation: listening ? 'pulse 1.5s infinite' : 'none',
        }}
      >
        {listening ? '⏹' : '🎤'}
      </button>
      {listening && (
        <span className="text-xs text-center px-2" style={{ color: theme.gray1 }}>
          {interim || hint || 'Говорите...'}
        </span>
      )}
      <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 0 0 4px ${theme.red}33; } 50% { box-shadow: 0 0 0 8px ${theme.red}22; } }`}</style>
    </div>
  );
}
