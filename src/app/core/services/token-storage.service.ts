import { Injectable, inject } from '@angular/core';
import { AuthTokens, AuthUser } from '../../domain/models/auth.model';
import { SecureStorageService } from './secure-storage.service';

interface StoredSession {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const STORAGE_KEY = 'auth:session';
const EMPTY_SESSION: StoredSession = { user: null, accessToken: null, refreshToken: null };

/**
 * The signed-in session. Persistence, encryption and the synchronous read path all live
 * in SecureStorageService, which is initialised before the router runs — guards and the
 * auth interceptor read this synchronously and cannot await a decrypt.
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

  getRefreshToken(): string | null {
    return this._session.refreshToken;
  }

  getUser(): AuthUser | null {
    return this._session.user;
  }

  setSession(user: AuthUser, tokens: AuthTokens): void {
    this.storage.set(STORAGE_KEY, {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    } satisfies StoredSession);
  }

  clear(): void {
    this.storage.remove(STORAGE_KEY);
  }
}
