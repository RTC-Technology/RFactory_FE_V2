import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService, PermissionMode } from '../../core/services/auth.service';

/**
 * Structural directive — checkPermission for templates. Shows the host element
 * only if the current user holds the given permission(s).
 *
 * ```html
 * <button *appHasPermission="'users.manage'">Delete user</button>
 * <button *appHasPermission="['users.manage','users.impersonate']; mode:'all'">...</button>
 * ```
 */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private _permission: string | string[] = [];
  private _mode: PermissionMode = 'any';
  private _created = false;

  @Input() set appHasPermission(value: string | string[]) {
    this._permission = value;
    this._render();
  }

  @Input() set appHasPermissionMode(mode: PermissionMode) {
    this._mode = mode;
    this._render();
  }

  constructor() {
    effect(() => {
      this.authService.permissions(); // re-evaluate whenever the signal changes (login/logout/refresh)
      this._render();
    });
  }

  private _render(): void {
    const allowed = this.authService.hasPermission(this._permission, this._mode);
    if (allowed && !this._created) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._created = true;
    } else if (!allowed && this._created) {
      this.viewContainer.clear();
      this._created = false;
    }
  }
}
