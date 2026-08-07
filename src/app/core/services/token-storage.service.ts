import { Injectable, inject } from '@angular/core';
import { AuthTokens, AuthUser } from '../../domain/models/auth.model';
import { SecureStorageService } from './secure-storage.service';

interface StoredSession {
  user: AuthUser | null;
  accessToken: string | null;
}

const STORAGE_KEY = 'auth:session';
const EMPTY_SESSION: StoredSession = { user: null, accessToken: null };

/**
 * The signed-in session. Persistence, encryption and the synchronous read path all live
 * in SecureStorageService, which is initialised before the router runs — guards and the
 * auth interceptor read this synchronously and cannot await a decrypt.
 *
 * Holds no refresh token: that one is an httpOnly cookie, deliberately out of reach of
 * this code. Only the short-lived access token is kept here.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly storage = inject(SecureStorageService);

  private get _session(): StoredSession {
    return this.storage.get<StoredSession>(STORAGE_KEY) ?? EMPTY_SESSION;
  }

  getAccessToken(): string | null {
    return this._session.accessToken;
  }

  getUser(): AuthUser | null {
    return this._session.user;
  }

  setSession(user: AuthUser, tokens: AuthTokens): void {
    this.storage.set(STORAGE_KEY, {
      user,
      accessToken: tokens.accessToken,
    } satisfies StoredSession);
  }

  clear(): void {
    this.storage.remove(STORAGE_KEY);
  }
}
