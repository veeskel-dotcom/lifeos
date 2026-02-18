/**
 * mediapipe.js — Lazy-загрузка MediaPipe Pose для видеоанализа.
 *
 * ~9MB загружается с CDN при первом использовании.
 * Singleton PoseLandmarker, GPU delegate с fallback на CPU.
 * Экспорт: getPoseLandmarker(), detectPose(img), processFrames(base64Array)
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

let poseLandmarker = null;
let visionModule = null;
let loading = null;

/**
 * Загрузить MediaPipe Vision module и инициализировать PoseLandmarker.
 * Возвращает singleton.
 */
export async function getPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  if (loading) return loading;

  loading = (async () => {
    // Dynamic import of MediaPipe Vision tasks
    const { PoseLandmarker, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );

    visionModule = { PoseLandmarker, FilesetResolver };

    const vision = await FilesetResolver.forVisionTasks(CDN_BASE);

    // Попробовать GPU delegate, fallback на CPU
    try {
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${CDN_BASE}/pose_landmarker_lite.task`,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    } catch {
      console.warn('[MediaPipe] GPU delegate failed, falling back to CPU');
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${CDN_BASE}/pose_landmarker_lite.task`,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    }

    return poseLandmarker;
  })();

  return loading;
}

/**
 * Определить позу на одном изображении (HTMLImageElement).
 * @returns {Array<{x,y,z,visibility}>} 33 landmark-а
 */
export async function detectPose(imgElement) {
  const lm = await getPoseLandmarker();
  const result = lm.detect(imgElement);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  return result.landmarks[0]; // Первый человек
}

/**
 * Обработать массив base64 кадров.
 * Для каждого кадра: создать Image → detectPose → вычислить углы.
 * @param {string[]} base64Frames - массив base64 JPEG
 * @returns {Array<{landmarks, angles}|null>}
 */
export async function processFrames(base64Frames) {
  const results = [];

  for (const frame of base64Frames) {
    try {
      const img = await loadImage(frame);
      const landmarks = await detectPose(img);
      if (landmarks) {
        results.push({
          landmarks,
          angles: computeAllAngles(landmarks),
        });
      } else {
        results.push(null);
      }
    } catch {
      results.push(null);
    }
  }

  return results;
}

/**
 * Загрузить base64 строку как HTMLImageElement.
 */
function loadImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  });
}

/**
 * Вычислить угол между тремя точками (в градусах).
 */
function computeAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
}

// MediaPipe Pose landmark indices
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

/**
 * Вычислить ключевые углы суставов.
 */
function computeAllAngles(landmarks) {
  const lm = landmarks;
  return {
    left_elbow: computeAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]),
    right_elbow: computeAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]),
    left_knee: computeAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]),
    right_knee: computeAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]),
    left_shoulder: computeAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW]),
    right_shoulder: computeAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW]),
    torso: computeAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]),
  };
}

/**
 * Выбрать N лучших кадров (с наибольшей visibility).
 */
export function selectKeyFrames(poseResults, n = 3) {
  const scored = poseResults
    .map((r, i) => ({ idx: i, score: r ? avgVisibility(r.landmarks) : 0 }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, n).sort((a, b) => a.idx - b.idx);
}

function avgVisibility(landmarks) {
  const vis = landmarks.map(l => l.visibility || 0);
  return vis.reduce((s, v) => s + v, 0) / vis.length;
}

/**
 * Проверить доступность MediaPipe.
 */
export async function isMediaPipeAvailable() {
  try {
    await getPoseLandmarker();
    return true;
  } catch {
    return false;
  }
}
