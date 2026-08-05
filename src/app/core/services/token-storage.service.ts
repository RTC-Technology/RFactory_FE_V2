import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthTokens, AuthUser } from '../../domain/models/auth.model';
import { decryptText, encryptText } from '../utils/crypto.util';

interface StoredSession {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const EMPTY_SESSION: StoredSession = { user: null, accessToken: null, refreshToken: null };

/**
 * Reads/writes are synchronous against an in-memory cache (guards and the
 * auth interceptor run synchronously and can't await a decrypt), backed by
 * localStorage. Outside of dev, the persisted blob is AES-GCM encrypted
 * (see crypto.util.ts for what that does and doesn't protect against) — dev
 * stores plain JSON so it stays easy to inspect while iterating.
 *
 * `init()` MUST resolve before anything reads from this service — it's
 * wired as an app initializer in app.config.ts so the encrypted session is
 * decrypted and the cache populated before the router (and its guards) run.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly STORAGE_KEY = 'auth:session';
  private _cache: StoredSession = EMPTY_SESSION;

  async init(): Promise<void> {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;

    const json = environment.production ? await decryptText(raw) : raw;
    if (!json) return;

    try {
      this._cache = JSON.parse(json) as StoredSession;
    } catch {
      this._cache = EMPTY_SESSION;
    }
  }

  getAccessToken(): string | null {
    return this._cache.accessToken;
  }

  getRefreshToken(): string | null {
    return this._cache.refreshToken;
  }

  getUser(): AuthUser | null {
    return this._cache.user;
  }

  setSession(user: AuthUser, tokens: AuthTokens): void {
    this._cache = { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    this._persist();
  }

  clear(): void {
    this._cache = EMPTY_SESSION;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private _persist(): void {
    const json = JSON.stringify(this._cache);
    if (!environment.production) {
      localStorage.setItem(this.STORAGE_KEY, json);
      return;
    }
    encryptText(json).then(cipher => localStorage.setItem(this.STORAGE_KEY, cipher));
  }
}
