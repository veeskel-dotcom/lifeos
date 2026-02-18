import db from '../db/index';
import { callAIVision } from '../ai/client';

/**
 * Extract frames from a video file using canvas.
 * Returns array of base64 JPEG strings.
 */
export function extractFrames(videoFile, numFrames = 6) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames = [];

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);

      const interval = duration / (numFrames + 1);
      let currentFrame = 0;

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        currentFrame++;
        if (currentFrame < numFrames) {
          video.currentTime = interval * (currentFrame + 1);
        } else {
          URL.revokeObjectURL(video.src);
          resolve(frames);
        }
      };

      video.currentTime = interval;
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Не удалось загрузить видео'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
}

// ═══ Метрики по спорту ═══

const SPORT_METRICS = {
  tennis: {
    metrics: ['stance', 'grip', 'swing', 'follow_through'],
    labels: { stance: 'Стойка', grip: 'Хватка', swing: 'Замах', follow_through: 'Сопровождение' },
  },
  skiing: {
    metrics: ['stance', 'edging', 'pole_plant', 'weight_transfer'],
    labels: { stance: 'Стойка', edging: 'Кантование', pole_plant: 'Укол палкой', weight_transfer: 'Перенос веса' },
  },
};

// ═══ Парсинг JSON из ответа AI ═══

function parseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Analyze frames via AI with optional MediaPipe pose data.
 * MediaPipe загружается лениво — если не получилось, анализируем только кадры.
 */
export async function analyzeWithAI(frames, sportType, strokeType) {
  const sportConfig = SPORT_METRICS[sportType] || SPORT_METRICS.tennis;
  const metricsStr = sportConfig.metrics.join(', ');

  // Попробовать MediaPipe для поз
  let poseData = null;
  let keyFrameIndices = [0, Math.floor(frames.length / 2), frames.length - 1];

  try {
    const { processFrames, selectKeyFrames } = await import('../lib/mediapipe');
    const poseResults = await processFrames(frames);
    const keyFrames = selectKeyFrames(poseResults, 3);

    if (keyFrames.length > 0) {
      keyFrameIndices = keyFrames.map(kf => kf.idx);
      poseData = keyFrames.map(kf => ({
        frame: kf.idx,
        angles: poseResults[kf.idx]?.angles || null,
      }));
    }
  } catch (e) {
    console.warn('[VideoAnalysis] MediaPipe unavailable, analyzing frames only:', e.message);
  }

  // Выбрать 3 ключевых кадра для отправки в AI
  const selectedFrames = keyFrameIndices.map(i => frames[i]).filter(Boolean);
  if (selectedFrames.length === 0) {
    throw new Error('Не удалось извлечь кадры из видео');
  }

  // Построить промпт
  const strokeInfo = strokeType ? `, элемент: ${strokeType}` : '';
  const poseInfo = poseData
    ? `\n\nДанные поз MediaPipe (углы суставов в градусах):\n${JSON.stringify(poseData, null, 2)}`
    : '';

  const prompt = `Ты — тренер по ${sportType === 'tennis' ? 'теннису' : 'лыжам'}${strokeInfo}.
Проанализируй технику спортсмена на фото.${poseInfo}

Верни JSON:
{
  "summary": "общий комментарий 2-3 предложения",
  "scores": {${sportConfig.metrics.map(m => `"${m}": число_1_10`).join(', ')}},
  "drills": ["упражнение 1", "упражнение 2", "упражнение 3"],
  "key_observations": ["наблюдение 1", "наблюдение 2"]
}

Метрики (1-10): ${metricsStr}.
Упражнения — конкретные, с числами повторений.
Только JSON.`;

  // Отправить первый ключевой кадр + промпт
  const imageBase64 = selectedFrames[0].replace(/^data:image\/\w+;base64,/, '');

  const result = await callAIVision({
    imageBase64,
    prompt,
    model: 'video_analysis',
    maxTokens: 800,
    temperature: 0.3,
  });

  const parsed = parseJSON(result.content);
  if (!parsed) {
    return {
      summary: result.content.slice(0, 500),
      scores: Object.fromEntries(sportConfig.metrics.map(m => [m, 5])),
      drills: [],
      key_observations: [],
    };
  }

  return {
    summary: parsed.summary || '',
    scores: parsed.scores || {},
    drills: parsed.drills || [],
    key_observations: parsed.key_observations || [],
    has_pose_data: !!poseData,
  };
}

export async function analyzeVideo(file, sportType, strokeType) {
  const frames = await extractFrames(file);
  const analysis = await analyzeWithAI(frames, sportType, strokeType);

  const id = await db.sport_videos.add({
    date: new Date().toISOString().split('T')[0],
    sport_type: sportType,
    stroke_type: strokeType || null,
    ai_analysis: analysis,
    frames: null,
    created_at: new Date().toISOString(),
  });

  return { id, analysis };
}

export async function getAnalyses(sportType) {
  try {
    let results = await db.sport_videos.orderBy('date').reverse().toArray();
    if (sportType) {
      results = results.filter(v => v.sport_type === sportType);
    }
    return results;
  } catch {
    return [];
  }
}

export async function getAnalysis(id) {
  try {
    return db.sport_videos.get(id);
  } catch {
    return null;
  }
}
