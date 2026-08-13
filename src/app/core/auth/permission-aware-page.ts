import { Directive, computed, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, PermissionMode } from '../services/auth.service';
import { PERMISSIONS } from './permissions';

/** The four codes `crud()` mints for one entity — see `permissions.ts`. */
export interface CrudPermissions {
  readonly view: string;
  readonly add: string;
  readonly edit: string;
  readonly delete: string;
}

type WriteAction = 'add' | 'edit' | 'delete';

/**
 * Base class for every routed page that sits behind `permissionGuard`.
 *
 * The guard already refuses entry, so this is not a second gate on the way in — it is the
 * one that stays. `TabReuseStrategy` detaches a tab instead of destroying it, so a page
 * opened while the user still held a code keeps rendering after that code is taken away;
 * the guard has no reason to run again until the next navigation. `denied` is a computed
 * over the permission signal, so the revocation lands the moment the new set arrives.
 *
 * Requirements are never re-declared here: the route's own `data.permissions` is read back,
 * which keeps `app.routes.ts` the single place a page's needs are written down and shared
 * with `RouteAccessService` (sidebar pruning) unchanged.
 *
 * ```ts
 * export class ProductTypeComponent extends PermissionAwarePage {
 *   constructor() { super(PERMISSIONS.productType); }
 * }
 * ```
 */
@Directive()
export abstract class PermissionAwarePage {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** The whole catalogue, so templates keep reading `perms.area.add`. */
  readonly perms = PERMISSIONS;

  private readonly required = (this.route.snapshot.data['permissions'] ?? []) as string[];
  private readonly mode = (this.route.snapshot.data['permissionMode'] ?? 'any') as PermissionMode;

  /** Codes the user is short of, in the same shape `/forbidden` renders. */
  readonly missing = computed(() => this.auth.missingPermissions(this.required, this.mode));

  readonly denied = computed(() => this.missing().length > 0);

  readonly canAdd = computed(() => this._canWrite('add'));
  readonly canEdit = computed(() => this._canWrite('edit'));
  readonly canDelete = computed(() => this._canWrite('delete'));

  /**
   * @param entity codes for the page's primary entity, feeding `canAdd`/`canEdit`/
   *   `canDelete`. Screens driving several panels from one `<ng-template #toolbar>` leave
   *   it out and keep `*appHasPermission`: inside that template `perms` is the context
   *   variable each panel is handed, not this class's field, and three flat flags cannot
   *   say which panel they belong to.
   */
  constructor(protected readonly entity?: CrudPermissions) {
    effect(() => {
      if (!this.denied()) return;
      // untracked: the redirect reads `missing`/`mode` and touches the router, none of
      // which should become dependencies of the effect that triggers it.
      untracked(() => this._evict());
    });
  }

  private _canWrite(action: WriteAction): boolean {
    // `entity` is a constructor parameter property, assigned after the field initializers
    // above have run. Reading it is only safe from a lazy position like this one.
    const code = this.entity?.[action];
    return !!code && this.auth.hasPermission(code);
  }

  /** Hands the denial to `/forbidden` in the format the guard uses, so it names the codes. */
  private _evict(): void {
    this.router.navigate(['/forbidden'], {
      queryParams: { required: this.missing().join(','), mode: this.mode },
    });
  }
}
