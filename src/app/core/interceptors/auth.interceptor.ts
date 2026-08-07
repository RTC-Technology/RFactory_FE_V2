import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { isAuthEndpoint } from '../services/auth-api.service';
import { isJwtExpired } from '../utils/jwt.util';

/**
 * How early a token counts as spent.
 *
 * Wide enough to cover the round trip plus clock drift between browser and server: a
 * request that leaves with three seconds of validity left can easily arrive after the
 * token has died. Access tokens last 30 minutes, so spending the last minute of each one
 * costs nothing.
 */
const REFRESH_SKEW_SECONDS = 60;

/** Attaches the bearer access token to outgoing requests, proactively refreshing it first if it's about to expire. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAuthEndpoint(req.url)) return next(req);

  const tokenStorage = inject(TokenStorageService);
  const token = tokenStorage.getAccessToken();
  if (!token) return next(req);

  if (!isJwtExpired(token, REFRESH_SKEW_SECONDS)) {
    return next(withAuthHeader(req, token));
  }

  // Access token is expired (or about to be) — refresh before sending.
  const authService = inject(AuthService);
  return authService.refreshAccessToken().pipe(
    switchMap(tokens => next(withAuthHeader(req, tokens.accessToken))),
    catchError(() => {
      authService.logout();
      return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session expired' }));
    }),
  );
};

export function withAuthHeader(req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}
