import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import { AuthTokens, AuthUser, LoginCredentials, UserProfileDto } from '../../domain/models/auth.model';

export const AUTH_API_BASE = `${environment.apiUrl}/auth`;

/**
 * Login, refresh-token and the internal /me call made right after them are the
 * "establish session" trio: they run before tokenStorage holds the fresh tokens,
 * so the auto-attach/refresh-on-401 logic in the interceptors (which reads from
 * tokenStorage) must not apply to them — auth-api.service attaches headers itself
 * where needed. Logout and /menus use the *current* stored token and go through
 * the normal interceptor pipeline like any other authenticated request.
 */
const BYPASS_INTERCEPTOR_PATHS = [`${AUTH_API_BASE}/login`, `${AUTH_API_BASE}/refresh-token`, `${AUTH_API_BASE}/me`];

/**
 * Matches on the full path only — a prefix test would also swallow sibling
 * endpoints that merely start with the same characters (`/auth/menus` vs `/auth/me`),
 * silently stripping their Authorization header.
 */
export function isAuthEndpoint(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return BYPASS_INTERCEPTOR_PATHS.includes(path);
}

interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

function toAuthUser(profile: UserProfileDto): AuthUser {
  return {
    id: String(profile.id),
    username: profile.loginName,
    name: profile.fullName,
    email: profile.email ?? '',
    isAdmin: profile.isAdmin,
    permissions: profile.permissions,
  };
}

function toAuthTokens(dto: AuthResponseDto): AuthTokens {
  return { accessToken: dto.accessToken, refreshToken: dto.refreshToken };
}

/**
 * Real backend calls for RFactory.API's /api/auth endpoints. login()/refresh()
 * only return a token pair — the user profile is fetched right after (using the
 * fresh access token) via GET /api/auth/me so AuthService gets a full AuthSession
 * in one call, same shape the old mock returned.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${AUTH_API_BASE}/login`, {
        loginName: credentials.username,
        password: credentials.password,
      })
      .pipe(switchMap(res => this._withProfile(res.data)));
  }

  refresh(refreshToken: string): Observable<AuthSession> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${AUTH_API_BASE}/refresh-token`, { refreshToken })
      .pipe(switchMap(res => this._withProfile(res.data)));
  }

  logout(): void {
    this.http.post<ApiResponse<unknown>>(`${AUTH_API_BASE}/logout`, {}).subscribe({ error: () => {} });
  }

  /** Fetches the profile using the just-issued access token, then pairs it with the tokens. */
  private _withProfile(tokens: AuthResponseDto): Observable<AuthSession> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${AUTH_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      .pipe(map(res => ({ user: toAuthUser(res.data), tokens: toAuthTokens(tokens) })));
  }
}
