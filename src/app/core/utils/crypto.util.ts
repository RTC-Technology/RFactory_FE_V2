/**
 * AES-GCM encrypt/decrypt for values persisted in localStorage.
 *
 * Honest caveat: the key material below ships inside this same JS bundle, so
 * this is NOT protection against a determined XSS attacker (they can read the
 * key too) — the real fix for that is httpOnly cookies, which this pure
 * client-side demo has no server to issue. What this DOES do: keep the
 * session out of plain sight for casual localStorage/log/devtools scraping
 * and browser-extension snooping, which is the realistic threat for a
 * client-only app. Swap the passphrase for a build-time secret if you want
 * a stronger bar.
 */
const PASSPHRASE = 'AdminSPA-local-storage-v1';

let cachedKey: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(PASSPHRASE))
      .then(digest => crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
  }
  return cachedKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export async function encryptText(plainText: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return bytesToBase64(combined);
}

export async function decryptText(cipherText: string): Promise<string | null> {
  try {
    const key = await getKey();
    const combined = base64ToBytes(cipherText);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}
