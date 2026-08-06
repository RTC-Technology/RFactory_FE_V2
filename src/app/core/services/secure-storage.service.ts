import { Injectable } from '@angular/core';
import { decryptText, encryptText } from '../utils/crypto.util';

/** Every persisted entry carries this prefix, so `init()` knows what belongs to us. */
const PREFIX = 'rf:';

/**
 * The single door to localStorage. Everything the app persists goes through here and is
 * AES-GCM encrypted — in development too, not only in production: a developer machine
 * holds real tokens against a real backend, and that was exactly where the session sat
 * in plain sight before.
 *
 * Reads are synchronous against an in-memory cache because callers need them during
 * construction and template binding, and WebCrypto only decrypts asynchronously. Writes
 * update the cache immediately and encrypt in the background, so a caller never waits on
 * the cipher.
 *
 * `init()` MUST resolve before anything reads — it is wired as an app initializer in
 * app.config.ts, ahead of the router and its guards.
 *
 * Honest caveat, unchanged from crypto.util: the key ships in this bundle, so this stops
 * casual devtools/extension/log scraping, not a determined XSS attacker.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly _cache = new Map<string, unknown>();

  async init(): Promise<void> {
    const entries: { key: string; cipher: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(PREFIX)) continue;
      const cipher = localStorage.getItem(storageKey);
      if (cipher) entries.push({ key: storageKey.slice(PREFIX.length), cipher });
    }

    await Promise.all(entries.map(async ({ key, cipher }) => {
      const json = await decryptText(cipher);
      if (json === null) {
        // Written under a different key, or tampered with. Drop it rather than leaving a
        // value that will never decrypt.
        localStorage.removeItem(PREFIX + key);
        return;
      }
      try {
        this._cache.set(key, JSON.parse(json));
      } catch {
        localStorage.removeItem(PREFIX + key);
      }
    }));
  }

  get<T>(key: string): T | null {
    return (this._cache.get(key) as T | undefined) ?? null;
  }

  set(key: string, value: unknown): void {
    this._cache.set(key, value);
    encryptText(JSON.stringify(value))
      .then(cipher => localStorage.setItem(PREFIX + key, cipher))
      // A failed write must not take the caller down; the value still lives in the cache
      // for this session and simply will not survive a reload.
      .catch(() => {});
  }

  remove(key: string): void {
    this._cache.delete(key);
    localStorage.removeItem(PREFIX + key);
  }
}
