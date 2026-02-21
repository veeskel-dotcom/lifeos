/**
 * voice.js — голосовой ввод через Web Speech API.
 * Используется AIChatScreen для кнопки 🎤.
 * iOS Safari поддерживает webkitSpeechRecognition.
 */

// ═══ Проверка поддержки ═══
export function isVoiceSupported() {
  return !!(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition
  );
}

// ═══ Запустить распознавание ═══
export function startListening(onResult, onError, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
        onResult?.({
          final: finalTranscript,
          interim: '',
          isFinal: true,
          confidence: event.results[i][0].confidence,
        });
      } else {
        interim += transcript;
        onResult?.({
          final: finalTranscript,
          interim,
          isFinal: false,
          confidence: event.results[i][0].confidence,
        });
      }
    }
  };

  recognition.onerror = (event) => {
    // 'no-speech' и 'aborted' — не ошибки, просто тишина
    if (event.error === 'no-speech' || event.error === 'aborted') {
      onEnd?.(finalTranscript || null);
      return;
    }
    onError?.(event.error);
  };

  recognition.onend = () => {
    onEnd?.(finalTranscript || null);
  };

  try {
    recognition.start();
  } catch (err) {
    onError?.(err.message);
    return null;
  }

  return recognition; // для .stop()
}
