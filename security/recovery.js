import { getSetting, setSetting, logSecurityEvent } from '../db/helpers';
import { getIterations } from './pin';

// Генерация Recovery Key: 16 байт → K7F2-M9X4-P3L8-W6N1
export function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.toUpperCase().match(/.{4}/g).join('-');
}

// Настройка Recovery Key (onboarding)
export async function setupRecovery(recoveryKey) {
  const encoder = new TextEncoder();
  const iterations = await getIterations();
  
  // Отдельная соль, НИКОГДА не меняется
  const recovery_salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(recoveryKey), 'PBKDF2', false, ['deriveKey', 'deriveBits']
  );
  
  // Wrapping key из recovery key
  const recoveryWrappingKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: recovery_salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  
  // Хеш для верификации
  const recoveryHash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: recovery_salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  
  await setSetting('recovery_salt', btoa(String.fromCharCode(...recovery_salt)));
  await setSetting('recovery_hash', btoa(String.fromCharCode(...new Uint8Array(recoveryHash))));
  
  return recoveryWrappingKey;
}

// Верификация Recovery Key (при забытом PIN)
export async function verifyRecoveryKey(inputKey) {
  const iterations = await getIterations();
  const saltB64 = await getSetting('recovery_salt');
  const storedHash = await getSetting('recovery_hash');
  
  if (!saltB64 || !storedHash) return { valid: false };
  
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(inputKey), 'PBKDF2', false, ['deriveBits', 'deriveKey']
  );
  
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  
  const inputHash = btoa(String.fromCharCode(...new Uint8Array(hash)));
  const valid = inputHash === storedHash;
  
  if (valid) {
    await logSecurityEvent('recovery_verified');
    // Derive wrapping key для расшифровки master key
    const wrappingKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    return { valid: true, wrappingKey };
  }
  
  return { valid: false };
}

// Восстановление: recovery key → сброс PIN
export async function recoverWithKey(recoveryKey, newPin) {
  const result = await verifyRecoveryKey(recoveryKey);
  if (!result.valid) return { success: false, error: 'invalid_key' };
  
  // Расшифровать master key через recovery wrapping key
  const { decryptMasterKeyWith, reEncryptMasterKey } = await import('./crypto');
  const masterKey = await decryptMasterKeyWith(result.wrappingKey, 'recovery');
  if (!masterKey) return { success: false, error: 'decrypt_failed' };
  
  // Создать новый PIN и перешифровать master key
  const { createPIN } = await import('./pin');
  const newWrappingKey = await createPIN(newPin);
  await reEncryptMasterKey(masterKey, newWrappingKey);
  
  await logSecurityEvent('recovery_used');
  return { success: true };
}
