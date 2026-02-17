// ═══ PBKDF2 с адаптивными итерациями ═══

import { getSetting, setSetting, logSecurityEvent } from '../db/helpers';

// Калибровка: подбираем iterations на ~300-500мс
export async function calibratePBKDF2() {
  const testPin = '000000';
  const testSalt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(testPin), 'PBKDF2', false, ['deriveBits']
  );
  
  let iterations = 100000;
  const start = performance.now();
  await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: testSalt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const elapsed = performance.now() - start;
  
  const targetMs = 400;
  iterations = Math.round(iterations * (targetMs / elapsed));
  iterations = Math.max(iterations, 300000);  // мин 300K (OWASP)
  iterations = Math.min(iterations, 2000000);  // макс 2M
  
  await setSetting('pbkdf2_iterations', iterations);
  return iterations;
}

export async function getIterations() {
  const stored = await getSetting('pbkdf2_iterations');
  return stored || await calibratePBKDF2();
}

// Хеширование PIN для ПРОВЕРКИ
export async function hashPIN(pin, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// Derive wrapping key из PIN для шифрования master key
export async function deriveWrappingKey(pin, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// Запрещённые PIN-ы
const BANNED_PINS = [
  '123456', '654321', '111111', '000000', '123123',
  '112233', '121212', '123321', '666666', '999999',
  '12345678', '87654321', '11111111', '00000000',
];

export function isPinBanned(pin) {
  if (BANNED_PINS.includes(pin)) return true;
  // Все одинаковые цифры
  if (new Set(pin.split('')).size === 1) return true;
  // Последовательность вверх/вниз
  const digits = pin.split('').map(Number);
  const isAsc = digits.every((d, i) => i === 0 || d === digits[i-1] + 1);
  const isDesc = digits.every((d, i) => i === 0 || d === digits[i-1] - 1);
  if (isAsc || isDesc) return true;
  return false;
}

// Индикатор силы
export function pinStrength(pin) {
  if (pin.length >= 8) return { level: 'strong', label: 'Сильный', color: '#34C759' };
  if (pin.length >= 6) return { level: 'medium', label: 'Средний', color: '#FF9500' };
  return { level: 'weak', label: 'Слабый', color: '#FF3B30' };
}

// ═══ СОЗДАНИЕ PIN (onboarding) ═══
export async function createPIN(pin) {
  const iterations = await getIterations();
  
  // Соль для проверки PIN
  const pin_salt = crypto.getRandomValues(new Uint8Array(16));
  const pin_hash = await hashPIN(pin, pin_salt, iterations);
  
  // Соль для wrapping key (отдельная от pin_salt!)
  const pin_enc_salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(pin, pin_enc_salt, iterations);
  
  // Сохраняем
  await setSetting('pin_hash', pin_hash);
  await setSetting('pin_salt', btoa(String.fromCharCode(...pin_salt)));
  await setSetting('pin_enc_salt', btoa(String.fromCharCode(...pin_enc_salt)));
  
  await logSecurityEvent('pin_created');
  
  return wrappingKey; // передаётся в setupEnvelopeEncryption()
}

// ═══ ПРОВЕРКА PIN ═══
export async function verifyPIN(inputPIN) {
  const iterations = await getIterations();
  const storedHash = await getSetting('pin_hash');
  const saltB64 = await getSetting('pin_salt');
  
  if (!storedHash || !saltB64) return false;
  
  const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const inputHash = await hashPIN(inputPIN, saltBytes, iterations);
  
  const isValid = inputHash === storedHash;
  await logSecurityEvent(isValid ? 'pin_success' : 'pin_failed');
  
  return isValid;
}

// ═══ СМЕНА PIN ═══
export async function changePIN(oldPin, newPin) {
  // 1. Проверяем старый
  const isValid = await verifyPIN(oldPin);
  if (!isValid) return { success: false, error: 'wrong_pin' };
  
  // 2. Расшифровываем master key старым PIN
  const { decryptMasterKey } = await import('./crypto');
  const masterKey = await decryptMasterKey(oldPin);
  if (!masterKey) return { success: false, error: 'decrypt_failed' };
  
  // 3. Создаём новый PIN и перешифровываем master key
  const newWrappingKey = await createPIN(newPin);
  const { reEncryptMasterKey } = await import('./crypto');
  await reEncryptMasterKey(masterKey, newWrappingKey);
  
  await logSecurityEvent('pin_changed');
  return { success: true };
}
