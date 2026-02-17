import { getSetting, setSetting, logSecurityEvent } from '../db/helpers';

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function isBiometricRegistered() {
  return !!(await getSetting('webauthn_credential_id'));
}

export async function registerBiometric() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'LifeOS', id: window.location.hostname },
      user: {
        id: new Uint8Array(16),
        name: 'lifeos-user',
        displayName: 'LifeOS User',
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  });

  await setSetting(
    'webauthn_credential_id',
    btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
  );
  await logSecurityEvent('faceid_registered');
  return true;
}

export async function authenticateBiometric() {
  const credentialId = await getSetting('webauthn_credential_id');
  if (!credentialId) return false;

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
          type: 'public-key',
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    await logSecurityEvent('faceid_success');
    return true;
  } catch {
    await logSecurityEvent('faceid_failed');
    return false;
  }
}
