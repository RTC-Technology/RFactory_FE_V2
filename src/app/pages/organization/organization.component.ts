import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { OrganizationApiService, UserApiService } from '../../core/services/organization-api.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { OrganizationDto, UserDto } from '../../domain/models/organization.model';
import { CollapsibleTree, DepthRow, flattenTree } from '../../shared/utils/tree-rows';

type EntityKind = 'org' | 'user';

interface EntityForm {
  code: string;
  name: string;
  parentId: number | null;
  loginName: string;
  password: string;
  email: string;
  isAdmin: boolean;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  org: 'org.org.lower',
  user: 'org.user.lower',
};

@Component({
  selector: 'app-organization',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './organization.component.html',
  styleUrl: './organization.component.scss',
})
export class OrganizationComponent extends PermissionAwarePage implements OnInit {
  private readonly orgApi = inject(OrganizationApiService);
  private readonly userApi = inject(UserApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  /** Splitter sizes go through SecureStorageService rather than PrimeNG's own plain-text stateStorage. */
  readonly split = inject(SplitStateService);

  readonly loading = computed(() => this.orgApi.loading() || this.userApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedOrg = signal<OrganizationDto | null>(null);
  readonly selectedUser = signal<UserDto | null>(null);

  readonly orgRows = computed<DepthRow<OrganizationDto>[]>(() =>
    flattenTree(this.orgApi.items(), (a, b) => a.organizationCode.localeCompare(b.organizationCode)));

  /** Mirrors the org panel's search box; the term itself lives inside p-table. */
  private readonly orgSearch = signal('');

  readonly tree = new CollapsibleTree(this.orgRows, this.orgSearch);

  readonly users = computed(() => {
    const orgId = this.selectedOrg()?.id;
    if (orgId == null) return [];
    return this.userApi.items().filter(u => u.organizationId === orgId);
  });

  /** Users the backend holds with no organization. No panel here can reach them. */
  readonly unassignedCount = computed(() =>
    this.userApi.items().filter(u => u.organizationId == null).length);

  /** Valid parents: every unit except the one being edited and its descendants. */
  readonly parentOptions = computed(() => {
    const editing = this.dialogKind() === 'org' ? this.editingId() : null;
    const blocked = editing != null ? this.tree.descendantIds(editing) : new Set<number>();
    return [
      { label: this.i18n.t('org.parentRoot'), value: null },
      ...this.orgRows()
        .filter(row => !blocked.has(row.id))
        .map(row => ({
          label: `${'— '.repeat(row.depth)}${row.organizationCode} · ${row.organizationName}`,
          value: row.id,
        })),
    ];
  });

  constructor() {
    // No entity passed: both panels gate on their own code set, handed to the shared
    // toolbar template through ngTemplateOutlet.
    super();

    effect(() => {
      const users = this.users();
      untracked(() => this.selectedUser.set(this._reconcile(this.selectedUser(), users)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({ orgs: this.orgApi.load(), users: this.userApi.load() }).subscribe({
      next: () => this.selectedOrg.set(this._reconcile(this.selectedOrg(), this.orgRows())),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('org.err.loadFailed'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly orgTable = viewChild<Table>('orgTable');
  private readonly userTable = viewChild<Table>('userTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    org: ['organizationCode', 'organizationName'],
    user: ['code', 'loginName', 'fullName', 'email'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    if (kind === 'org') this.orgSearch.set(value);
    const table = kind === 'org' ? this.orgTable() : this.userTable();
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'org') {
      this.selectedOrg.set(this._reconcile(this.selectedOrg(), visible as OrganizationDto[]));
    } else {
      this.selectedUser.set(this._reconcile(this.selectedUser(), visible as UserDto[]));
    }
  }

  // ─── Selection / tree ───────────────────────────────────────────────────────

  selectOrg(org: OrganizationDto): void {
    if (this.selectedOrg()?.id === org.id) return;
    this.selectedOrg.set(org);
  }

  selectUser(user: UserDto): void {
    this.selectedUser.set(user);
  }

  toggleCollapse(id: number, event: Event): void {
    // The toggle lives inside the row, which is itself a select target.
    event.stopPropagation();

    const swallowed = this.tree.toggle(id);
    // Collapsing over the current selection would leave it driving the detail panel from
    // off-screen; hand the selection to the branch that swallowed it.
    const selected = this.selectedOrg();
    if (selected && selected.id !== id && swallowed.has(selected.id)) {
      const collapsedRow = this.orgApi.items().find(o => o.id === id);
      if (collapsedRow) this.selectedOrg.set(collapsedRow);
    }
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('org');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = this._emptyForm();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = {
      ...this._emptyForm(),
      // A new unit defaults under whatever is selected — the common case is adding a
      // sub-unit to the one you are looking at.
      parentId: kind === 'org' ? this.selectedOrg()?.id ?? null : null,
    };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = kind === 'org' ? this.selectedOrg() : this.selectedUser();
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = kind === 'org'
      ? {
          ...this._emptyForm(),
          code: (row as OrganizationDto).organizationCode,
          name: (row as OrganizationDto).organizationName,
          parentId: (row as OrganizationDto).parentId ?? null,
        }
      : {
          ...this._emptyForm(),
          code: (row as UserDto).code,
          name: (row as UserDto).fullName,
          loginName: (row as UserDto).loginName,
          email: (row as UserDto).email ?? '',
          isAdmin: (row as UserDto).isAdmin,
          // Left blank on purpose: the backend reads null as "keep the stored hash".
          password: '',
        };
    this.dialogOpen.set(true);
  }

  save(): void {
    const kind = this.dialogKind();
    const error = this._validate(kind);
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const request = this._buildRequest(kind, id);
    if (!request) {
      this.saving.set(false);
      return;
    }

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', { entity: this._noun(kind) }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this._noun(kind) }));
      },
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  askDelete(kind: EntityKind): void {
    const row = kind === 'org' ? this.selectedOrg() : this.selectedUser();
    if (!row) return;

    const blocker = kind === 'org' ? this._orgBlocker(row.id) : this._userBlocker(row.id);
    if (blocker) {
      this._fail(blocker);
      return;
    }

    const label = kind === 'org'
      ? (row as OrganizationDto).organizationName
      : (row as UserDto).fullName;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => (kind === 'org' ? this.orgApi : this.userApi).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  /** Delete is a non-cascading soft delete, so anything still pointing here is stranded. */
  private _orgBlocker(id: number): string {
    const children = this.orgApi.items().filter(o => o.parentId === id).length;
    if (children) return this.i18n.t('org.err.hasChildren', { count: children });

    const users = this.userApi.items().filter(u => u.organizationId === id).length;
    if (users) return this.i18n.t('org.err.hasUsers', { count: users });
    return '';
  }

  /** Deleting your own row would end the session mid-action and leave no way back in. */
  private _userBlocker(id: number): string {
    return this.auth.currentUser()?.id === String(id) ? this.i18n.t('org.err.deleteSelf') : '';
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm(): EntityForm {
    return { code: '', name: '', parentId: null, loginName: '', password: '', email: '', isAdmin: false };
  }

  private _noun(kind: EntityKind): string {
    return this.i18n.t(LABEL_KEYS[kind]);
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(kind: EntityKind): string {
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) return this.i18n.t('plant.err.codeRequired');
    if (!name) return this.i18n.t('plant.err.nameRequired');

    const siblings: { id: number; code: string }[] = kind === 'org'
      ? this.orgApi.items().map(o => ({ id: o.id, code: o.organizationCode }))
      : this.userApi.items().map(u => ({ id: u.id, code: u.code }));

    const clash = siblings.find(
      row => row.code.toLowerCase() === code.toLowerCase() && row.id !== this.editingId(),
    );
    if (clash) return this.i18n.t('plant.err.codeTaken', { code });

    if (kind === 'org') return '';

    if (!this.selectedOrg()) return this.i18n.t('org.err.pickOrg');

    const login = this.form.loginName.trim();
    if (!login) return this.i18n.t('org.err.loginRequired');

    // Login name is the credential the whole auth flow resolves on, so it has to be
    // unique across every user, not just inside this organization.
    const loginClash = this.userApi.items().find(
      u => u.loginName.toLowerCase() === login.toLowerCase() && u.id !== this.editingId(),
    );
    if (loginClash) return this.i18n.t('org.err.loginTaken', { login });

    if (!this.editingId() && !this.form.password) return this.i18n.t('org.err.passwordRequired');
    return '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    const code = this.form.code.trim();
    const name = this.form.name.trim();

    if (kind === 'org') {
      const body = {
        organizationCode: code,
        organizationName: name,
        parentId: this.form.parentId,
      };
      return id ? this.orgApi.update(id, body) : this.orgApi.create(body);
    }

    const organizationId = this.selectedOrg()?.id;
    if (organizationId == null) return null;

    const body = {
      organizationId,
      code,
      fullName: name,
      loginName: this.form.loginName.trim(),
      email: this.form.email.trim() || null,
      isAdmin: this.form.isAdmin,
      // Null on edit keeps the stored hash; on create the validator has already
      // insisted on a value.
      password: this.form.password || null,
    };
    return id ? this.userApi.update(id, body) : this.userApi.create(body);
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail,
      life: 4500,
    });
  }
}
