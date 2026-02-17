import { useState, useRef, useCallback } from 'react';
import { isVoiceSupported, startListening } from '../ai/voice';

/**
 * VoiceInput — кнопка 🎤 с Web Speech API через ai/voice.js.
 * Пульсирующий круг во время записи, interim текст снизу.
 * @param {function} onResult - (text) => void
 * @param {object} theme
 */
export default function VoiceInput({ onResult, theme }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);

  const supported = isVoiceSupported();

  const start = useCallback(() => {
    if (!supported) {
      alert('Голосовой ввод не поддерживается в этом браузере');
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
      (err) => {
        console.warn('Voice error:', err);
        setListening(false);
        setInterim('');
      },
      (finalText) => {
        setListening(false);
        if (finalText) onResult?.(finalText);
        setInterim('');
      }
    );
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={listening ? stop : start}
        className="relative flex items-center justify-center w-9 h-9 rounded-full transition-transform active:scale-95 shrink-0"
        style={{
          background: listening ? theme.red : theme.accent,
        }}
      >
        {/* Пульсация при записи */}
        {listening && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: theme.red }}
          />
        )}
        <span className="text-base relative z-10">🎤</span>
      </button>

      {/* Interim текст */}
      {interim && (
        <p className="text-xs text-center max-w-48 truncate" style={{ color: theme.gray1 }}>
          {interim}...
        </p>
      )}

      {!supported && (
        <p className="text-xs" style={{ color: theme.gray2 }}>
          Голосовой ввод недоступен
        </p>
      )}
    </div>
  );
}
