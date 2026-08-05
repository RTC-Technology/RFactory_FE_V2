import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { isAuthEndpoint } from '../services/auth-api.service';
import { withAuthHeader } from './auth.interceptor';

/**
 * Reactive fallback for authInterceptor's proactive check: catches a 401 that
 * slips through (e.g. the server revoked the token early), refreshes once,
 * and retries the original request. Logs out if the refresh itself fails.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => err);
      }
      return authService.refreshAccessToken().pipe(
        switchMap(tokens => next(withAuthHeader(req, tokens.accessToken))),
        catchError(refreshErr => {
          authService.logout();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
