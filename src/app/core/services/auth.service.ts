import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthTokens, AuthUser, LoginCredentials } from '../../domain/models/auth.model';
import { AuthApiService } from './auth-api.service';
import { TokenStorageService } from './token-storage.service';

export type PermissionMode = 'any' | 'all';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(this.tokenStorage.getUser());
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly permissions = computed(() => this._user()?.permissions ?? []);

  /** Dedupes concurrent refresh calls (e.g. several requests 401-ing at once) into one. */
  private _refreshInFlight$: Observable<AuthTokens> | null = null;

  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.api.login(credentials).pipe(
      tap(({ user, tokens }) => this._applySession(user, tokens)),
      map(({ user }) => user),
    );
  }

  logout(): void {
    this.api.logout();
    this.tokenStorage.clear();
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  refreshAccessToken(): Observable<AuthTokens> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (!refreshToken) return throwError(() => new Error('Không có refresh token.'));

    if (!this._refreshInFlight$) {
      this._refreshInFlight$ = this.api.refresh(refreshToken).pipe(
        tap(({ user, tokens }) => this._applySession(user, tokens)),
        map(({ tokens }) => tokens),
        finalize(() => { this._refreshInFlight$ = null; }),
        shareReplay(1),
      );
    }
    return this._refreshInFlight$;
  }

  /** checkPermission: superadmins (isAdmin) hold every permission implicitly. */
  hasPermission(required: string | string[], mode: PermissionMode = 'any'): boolean {
    const list = Array.isArray(required) ? required : [required];
    if (list.length === 0) return true;
    if (this._user()?.isAdmin) return true;
    const perms = this.permissions();
    return mode === 'all' ? list.every(p => perms.includes(p)) : list.some(p => perms.includes(p));
  }

  private _applySession(user: AuthUser, tokens: AuthTokens): void {
    this.tokenStorage.setSession(user, tokens);
    this._user.set(user);
  }
}
