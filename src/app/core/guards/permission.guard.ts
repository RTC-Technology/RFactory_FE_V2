import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PermissionMode } from '../services/auth.service';

/**
 * Blocks access to a route unless the user holds the permissions declared in
 * its route `data`, e.g. `data: { permissions: ['users.view'] }`.
 * Optional `data: { permissionMode: 'all' }` requires every permission (default: 'any').
 */
export const permissionGuard: CanActivateFn = route => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const required = route.data['permissions'] as string[] | undefined;
  if (!required?.length) return true;

  const mode = (route.data['permissionMode'] as PermissionMode) ?? 'any';
  return authService.hasPermission(required, mode) || router.createUrlTree(['/forbidden']);
};
