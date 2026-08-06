import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PermissionMode } from '../services/auth.service';

/**
 * Blocks access to a route unless the user holds the permissions declared in
 * its route `data`, e.g. `data: { permissions: ['factory.view'] }`.
 * Optional `data: { permissionMode: 'all' }` requires every permission (default: 'any').
 *
 * The codes that were missing travel to /forbidden as a query param, so the page can name
 * them. A screen that reads several entities needs a view code for each, and without that
 * list a denial gives whoever administers the account nothing to act on.
 */
export const permissionGuard: CanActivateFn = route => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const required = route.data['permissions'] as string[] | undefined;
  if (!required?.length) return true;

  const mode = (route.data['permissionMode'] as PermissionMode) ?? 'any';
  const missing = authService.missingPermissions(required, mode);
  if (missing.length === 0) return true;

  return router.createUrlTree(['/forbidden'], {
    queryParams: { required: missing.join(','), mode },
  });
};
