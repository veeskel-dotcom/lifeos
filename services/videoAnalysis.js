import db from '../db/index';

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

/**
 * Analyze frames via AI.
 * In production: sends to OpenRouter → GPT-4o Vision.
 * For now: returns mock analysis.
 */
export async function analyzeWithAI(frames, sportType, strokeType) {
  try {
    // TODO: integrate with src/ai/client.js when available
    // const prompt = buildPrompt(sportType, strokeType);
    // const result = await aiClient.vision(frames, prompt);

    // Mock response for now
    await new Promise(r => setTimeout(r, 1500));

    const analyses = {
      tennis: {
        summary: 'Хорошая базовая техника. Рекомендуется поработать над ротацией бёдер для увеличения мощности удара.',
        scores: { stance: 7, grip: 6, swing: 5, follow_through: 6 },
        drills: [
          'Shadow swings: 3×20 ударов без мяча, фокус на ротации',
          'Wall rallies: 5 минут форхенд у стены',
          'Footwork ladder: 3×10 боковых перемещений',
        ],
      },
      skiing: {
        summary: 'Стойка немного высоковата. Согните колени сильнее и перенесите вес на переднюю часть ботинка.',
        scores: { stance: 5, edging: 6, pole_plant: 7, weight_transfer: 5 },
        drills: [
          'Плуг на пологом склоне: 5 спусков',
          'Упражнение «самолёт»: руки в стороны, повороты',
          'Короткие повороты с акцентом на укол палкой',
        ],
      },
    };

    return analyses[sportType] || analyses.tennis;

  } catch (e) {
    console.error('[videoAnalysis.analyzeWithAI]', e);
    throw e;
  }
}

export async function analyzeVideo(file, sportType, strokeType) {
  try {
    const frames = await extractFrames(file);
    const analysis = await analyzeWithAI(frames, sportType, strokeType);

    const id = await db.sport_videos.add({
      date: new Date().toISOString().split('T')[0],
      sport_type: sportType,
      stroke_type: strokeType || null,
      ai_analysis: analysis,
      frames: null, // Don't store frames in DB (too large)
      created_at: new Date().toISOString(),
    });

    return { id, analysis };

  } catch (e) {
    console.error('[videoAnalysis.analyzeVideo]', e);
    throw e;
  }
}

export async function getAnalyses(sportType) {
  try {
    let results = await db.sport_videos.orderBy('date').reverse().toArray();
    if (sportType) {
      results = results.filter(v => v.sport_type === sportType);
    }
    return results;

  } catch (e) {
    console.error('[videoAnalysis.getAnalyses]', e);
    return [];
  }
}

export async function getAnalysis(id) {
  try {
    return db.sport_videos.get(id);

  } catch (e) {
    console.error('[videoAnalysis.getAnalysis]', e);
    return [];
  }
}
