import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
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

  /**
   * Asks the server for a new access token. Nothing is passed in: the refresh token is an
   * httpOnly cookie the browser attaches by itself, so this code has no way to read it and
   * no way to check it up front — a missing or expired cookie comes back as a 401.
   */
  refreshAccessToken(): Observable<AuthTokens> {
    if (!this._refreshInFlight$) {
      this._refreshInFlight$ = this.api.refresh().pipe(
        tap(({ user, tokens }) => this._applySession(user, tokens)),
        map(({ tokens }) => tokens),
        finalize(() => { this._refreshInFlight$ = null; }),
        shareReplay(1),
      );
    }
    return this._refreshInFlight$;
  }

  /**
   * Superadmins (isAdmin) hold every permission implicitly; everyone else is checked
   * against the function codes the backend resolved from their user groups.
   *
   * Matching ignores case, because the codes are typed by hand on the permission screen
   * and the backend already de-duplicates them case-insensitively — a route asking for
   * `user.manage` must not miss a stored `User.Manage`.
   */
  hasPermission(required: string | string[], mode: PermissionMode = 'any'): boolean {
    return this.missingPermissions(required, mode).length === 0;
  }

  /**
   * Which of `required` the user is short of — empty when they are allowed through.
   *
   * Exists so a denial can name the codes to grant. "You lack permission" on a screen
   * that quietly needs three of them is a dead end for whoever has to fix the account.
   *
   * Under `any` a single miss is not a shortfall, so nothing is reported until every
   * option has failed — and then all of them are, since any one would do.
   */
  missingPermissions(required: string | string[], mode: PermissionMode = 'any'): string[] {
    const list = Array.isArray(required) ? required : [required];
    if (list.length === 0 || this._user()?.isAdmin) return [];

    const held = new Set(this.permissions().map(code => code.toLowerCase()));
    const missing = list.filter(code => !held.has(code.toLowerCase()));

    if (mode === 'all') return missing;
    return missing.length === list.length ? list : [];
  }

  private _applySession(user: AuthUser, tokens: AuthTokens): void {
    this.tokenStorage.setSession(user, tokens);
    this._user.set(user);
  }
}
