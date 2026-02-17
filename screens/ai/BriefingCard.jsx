import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import {
  collectBriefingData,
  shouldShowBriefing,
  generateTemplateBriefing,
  generateAIBriefing,
  getGreeting,
} from '../../services/briefing';
import { getSetting } from '../../db/helpers';

export default function BriefingCard({ theme, onOpenChat }) {
  const [lines, setLines] = useState([]);
  const [greeting, setGreeting] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('template'); // 'template' | 'ai'

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async () => {
    try {
      // Проверить режим
      const briefingMode = (await getSetting('briefing_mode')) || 'smart';
      if (briefingMode === 'never') {
        setLoading(false);
        setVisible(false);
        return;
      }

      setGreeting(getGreeting());
      const data = await collectBriefingData();

      // smart = только если есть что показать
      if (briefingMode === 'smart' && !shouldShowBriefing(data)) {
        setLoading(false);
        setVisible(false);
        return;
      }

      // Шаблонный ($0) — всегда
      const templateLines = generateTemplateBriefing(data);
      setLines(templateLines);
      setMode('template');
      setVisible(true);
      setLoading(false);

      // Попробовать AI-обогащение (async, не блокирует)
      if (templateLines.length > 0) {
        try {
          const aiText = await generateAIBriefing(data);
          if (aiText) {
            setLines(aiText.split('\n').filter(Boolean));
            setMode('ai');
          }
        } catch {
          // fallback на шаблонный — уже показан
        }
      }
    } catch (err) {
      console.warn('Briefing error:', err);
      setLoading(false);
    }
  };

  if (loading || !visible || lines.length === 0) return null;

  return (
    <Card theme={theme} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header with gradient accent */}
      <div
        className="px-4 pt-4 pb-2"
        style={{
          background: `linear-gradient(135deg, ${theme.accent}08, ${theme.accent}03)`,
        }}
      >
        <div className="text-base font-semibold" style={{ color: theme.text }}>
          {greeting}
        </div>
      </div>

      {/* Briefing lines */}
      <div className="px-4 pb-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-sm py-1 leading-relaxed"
            style={{ color: theme.text }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-t"
        style={{ borderColor: theme.gray5 }}
      >
        <span className="text-[10px]" style={{ color: theme.gray2 }}>
          {mode === 'ai' ? '🤖 AI-анализ' : '📊 Обзор дня'}
        </span>
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="text-xs font-medium"
            style={{ color: theme.accent }}
          >
            Подробнее →
          </button>
        )}
      </div>
    </Card>
  );
}
