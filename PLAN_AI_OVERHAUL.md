# План: Полная переделка AI-системы LifeOS

## Статус: ОТЛОЖЕН (сначала фиксим баги с телефона)

## Контекст
Текущая AI-система использует 2 жёстко прописанные модели (`fast`=Gemini Flash, `smart`=Claude Sonnet 4). Нужно:
1. Назначить конкретные модели под конкретные задачи (Opus 4.6 / Sonnet 4.5 / Flash 2.5)
2. UI для выбора модели из выпадающего списка + настройка лимитов
3. Двухшаговое распознавание еды (фото → ингредиенты → FatSecret → LLM уточнение)
4. MediaPipe Pose + LLM для видеоанализа техники (убрать заглушку)

---

## Фаза 1: Фундамент — центральный реестр моделей

### 1.1 `utils/constants.js` — единый источник правды

Добавить `MODEL_REGISTRY` — маппинг задача→модель:

| Ключ задачи | Модель по умолчанию | Для чего |
|---|---|---|
| `parsing` | `google/gemini-2.5-flash-preview` | Парсинг текста, категоризация, голос |
| `analysis` | `anthropic/claude-opus-4-20250514` | Глубокий анализ, рекомендации по питанию |
| `reports` | `anthropic/claude-sonnet-4-5-20250929` | Еженедельные отчёты |
| `briefing` | `anthropic/claude-sonnet-4-5-20250929` | Утренний брифинг |
| `ocr` | `anthropic/claude-sonnet-4-5-20250929` | OCR чеков, выписок, документов |
| `food_vision` | `anthropic/claude-sonnet-4-5-20250929` | Распознавание еды (шаг 1: фото→ингредиенты) |
| `food_disambig` | `google/gemini-2.5-flash-preview` | Уточнение совпадения в БД (шаг 2) |
| `video_analysis` | `anthropic/claude-sonnet-4-5-20250929` | Видеоанализ техники с позами |

Также: COST_RATES, AVAILABLE_MODELS, TASK_TYPE_LABELS. Обновить AI_LIMITS.

### 1.2 `ai/client.js` — resolveModel(taskKey) с legacy fallback
### 1.3 `api/openrouter.js` — убрать дубли MODELS/COST_RATES
### 1.4 `ai/cost.js` — добавить getStats(), обновить checkLimits()

## Фаза 2: Переназначение моделей в сервисах
- cascade.js: fast→parsing, smart→analysis
- categorize.js: fast→parsing
- ocr.js: добавить model:'ocr'
- briefing.js: processInput→callAI(model:'briefing')
- crossAnalysis.js: processInput→callAI(model:'reports')

## Фаза 3: AISettings.jsx — полная переделка UI (модели, лимиты, статистика)

## Фаза 4: foodVision.js — двухшаговый пайплайн с FatSecret

## Фаза 5: MediaPipe Pose + videoAnalysis.js — заменить заглушку

## Файлы: 13 изменить, 1 создать (lib/mediapipe.js)
