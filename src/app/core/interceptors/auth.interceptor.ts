import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { isAuthEndpoint } from '../services/auth-api.service';
import { isJwtExpired } from '../utils/jwt.util';

/** Attaches the bearer access token to outgoing requests, proactively refreshing it first if it's about to expire. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAuthEndpoint(req.url)) return next(req);

  const tokenStorage = inject(TokenStorageService);
  const token = tokenStorage.getAccessToken();
  if (!token) return next(req);

  if (!isJwtExpired(token, 5)) {
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
