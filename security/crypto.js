import { getSetting, setSetting } from '../db/helpers';

// ═══ ENVELOPE ENCRYPTION ═══
// Master Key → шифрует данные
// Master Key обёрнут PIN-ом (+ отдельно Recovery Key)
// При смене PIN: master key НЕ меняется, меняется только обёртка

// Генерация master key (один раз при onboarding)
export async function generateMasterKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable — нужно для wrap/unwrap
    ['encrypt', 'decrypt']
  );
}

// Обернуть (encrypt) master key wrapping key-ом
async function wrapKey(masterKey, wrappingKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const exported = await crypto.subtle.exportKey('raw', masterKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    exported
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

// Развернуть (decrypt) master key
async function unwrapKey(wrapped, wrappingKey) {
  const iv = Uint8Array.from(atob(wrapped.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(wrapped.data), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    data
  );
  
  return crypto.subtle.importKey(
    'raw', decrypted,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ═══ SETUP (onboarding) ═══
export async function setupEnvelopeEncryption(pinWrappingKey, recoveryWrappingKey) {
  const masterKey = await generateMasterKey();
  
  // Обернуть PIN-ом
  const encByPin = await wrapKey(masterKey, pinWrappingKey);
  await setSetting('encrypted_master_by_pin', encByPin);
  
  // Обернуть Recovery Key
  const encByRecovery = await wrapKey(masterKey, recoveryWrappingKey);
  await setSetting('encrypted_master_by_recovery', encByRecovery);
  
  await setSetting('enc_version', 1);
  
  return masterKey;
}

// ═══ DECRYPT MASTER KEY ═══
export async function decryptMasterKey(pin) {
  const { deriveWrappingKey, getIterations } = await import('./pin');
  const iterations = await getIterations();
  const saltB64 = await getSetting('pin_enc_salt');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  
  const wrappingKey = await deriveWrappingKey(pin, salt, iterations);
  const wrapped = await getSetting('encrypted_master_by_pin');
  
  try {
    return await unwrapKey(wrapped, wrappingKey);
  } catch {
    return null;
  }
}

export async function decryptMasterKeyWith(wrappingKey, source = 'pin') {
  const key = source === 'recovery' ? 'encrypted_master_by_recovery' : 'encrypted_master_by_pin';
  const wrapped = await getSetting(key);
  try {
    return await unwrapKey(wrapped, wrappingKey);
  } catch {
    return null;
  }
}

// Перешифровать master key новым wrapping key (при смене PIN)
export async function reEncryptMasterKey(masterKey, newWrappingKey) {
  const encByPin = await wrapKey(masterKey, newWrappingKey);
  await setSetting('encrypted_master_by_pin', encByPin);
}

// ═══ ENCRYPT/DECRYPT DATA (для критичных данных) ═══
export async function encryptData(masterKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoder.encode(plaintext)
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

export async function decryptData(masterKey, encrypted) {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    data
  );
  return new TextDecoder().decode(decrypted);
}
