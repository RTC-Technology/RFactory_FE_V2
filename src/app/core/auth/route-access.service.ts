import { Injectable, inject } from '@angular/core';
import { Route, Router } from '@angular/router';
import { AuthService, PermissionMode } from '../services/auth.service';

interface RouteRule {
  permissions: string[];
  mode: PermissionMode;
}

/**
 * Answers whether the current user could actually activate a URL, by reading the same
 * `data.permissions` the route guard uses.
 *
 * The backend already hides menu items gated on a FunctionId the user lacks, but that
 * only covers the gate an admin set on the *menu row*. A public menu item pointing at a
 * guarded route slips through: the sidebar shows it, the guard then refuses it. Checking
 * the route's own requirement closes that without asking admins to keep menu FunctionIds
 * and route guards in sync by hand.
 */
@Injectable({ providedIn: 'root' })
export class RouteAccessService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Built once: the router config does not change at runtime. */
  private _rules?: Map<string, RouteRule>;

  canAccess(url: string | undefined | null): boolean {
    if (!url) return true;

    const rule = this._ruleFor(url);
    if (!rule) return true;
    return this.auth.hasPermission(rule.permissions, rule.mode);
  }

  private _ruleFor(url: string): RouteRule | undefined {
    this._rules ??= this._collect(this.router.config, '');
    return this._rules.get(this._normalise(url));
  }

  /** Flattens the config into full-path → requirement, skipping routes that declare none. */
  private _collect(routes: Route[], prefix: string): Map<string, RouteRule> {
    const rules = new Map<string, RouteRule>();

    for (const route of routes) {
      const path = [prefix, route.path].filter(Boolean).join('/');
      const permissions = route.data?.['permissions'] as string[] | undefined;

      if (permissions?.length) {
        rules.set(this._normalise(path), {
          permissions,
          mode: (route.data?.['permissionMode'] as PermissionMode) ?? 'any',
        });
      }

      if (route.children?.length) {
        for (const [key, value] of this._collect(route.children, path)) {
          rules.set(key, value);
        }
      }
    }

    return rules;
  }

  private _normalise(url: string): string {
    return url.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '');
  }
}
