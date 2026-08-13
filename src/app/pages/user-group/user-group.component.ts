import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { FunctionApiService, FunctionGroupApiService } from '../../core/services/function-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { OrganizationApiService, UserApiService } from '../../core/services/organization-api.service';
import { UserGroupApiService } from '../../core/services/user-group-api.service';
import { FunctionDto } from '../../domain/models/function-dto.model';
import { UserDto } from '../../domain/models/organization.model';
import { UserGroupDto } from '../../domain/models/user-group.model';
import { flattenTree } from '../../shared/utils/tree-rows';

/** One line of the permission picker: either a group header or a selectable function. */
interface PermissionRow {
  kind: 'group' | 'function';
  id: number;
  code: string;
  name: string;
  depth: number;
  /** Function ids this row governs — itself for a function, the whole subtree for a group. */
  functionIds: number[];
}

@Component({
  selector: 'app-user-group',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, CheckboxModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './user-group.component.html',
  styleUrl: './user-group.component.scss',
})
export class UserGroupComponent extends PermissionAwarePage implements OnInit {
  private readonly groupApi = inject(UserGroupApiService);
  private readonly functionApi = inject(FunctionApiService);
  private readonly functionGroupApi = inject(FunctionGroupApiService);
  private readonly userApi = inject(UserApiService);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  /** Splitter sizes go through SecureStorageService rather than PrimeNG's own plain-text stateStorage. */
  readonly split = inject(SplitStateService);

  readonly loading = computed(() => this.groupApi.loading() || this.functionApi.loading());

  readonly groups = this.groupApi.items;
  readonly selectedGroup = signal<UserGroupDto | null>(null);

  /** Assignments of the selected group, fetched per selection rather than up front. */
  private readonly assignedFunctionIds = signal<number[]>([]);
  private readonly assignedUserIds = signal<number[]>([]);

  readonly assignedFunctions = computed(() => {
    const ids = new Set(this.assignedFunctionIds());
    return this.functionApi.items().filter(f => ids.has(f.id));
  });

  readonly members = computed(() => {
    const ids = new Set(this.assignedUserIds());
    return this.userApi.items().filter(u => ids.has(u.id));
  });

  orgName(id?: number | null): string {
    return this.orgApi.items().find(o => o.id === id)?.organizationName ?? '';
  }

  constructor() {
    // Every write on this screen — the group itself, its function grants and its members —
    // is gated on `user-group.*`, so one entity covers the whole page.
    super(PERMISSIONS.userGroup);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      groups: this.groupApi.load(),
      functions: this.functionApi.load(),
      functionGroups: this.functionGroupApi.load(),
      users: this.userApi.load(),
      orgs: this.orgApi.load(),
    }).subscribe({
      next: ({ groups }) => this.selectGroup(this._reconcile(this.selectedGroup(), groups), true),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('ug.err.loadFailed'), err),
    });
  }

  // ─── Selection ──────────────────────────────────────────────────────────────

  selectGroup(group: UserGroupDto | null, force = false): void {
    if (!force && this.selectedGroup()?.id === group?.id) return;
    this.selectedGroup.set(group);

    if (!group) {
      this.assignedFunctionIds.set([]);
      this.assignedUserIds.set([]);
      return;
    }
    this._loadAssignments(group.id);
  }

  private _loadAssignments(groupId: number): void {
    forkJoin({
      functions: this.groupApi.functionIds(groupId),
      users: this.groupApi.userIds(groupId),
    }).subscribe({
      next: ({ functions, users }) => {
        this.assignedFunctionIds.set(functions);
        this.assignedUserIds.set(users);
      },
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('ug.err.loadFailed'), err),
    });
  }

  // ─── Global filter (group panel) ────────────────────────────────────────────

  private readonly groupTable = viewChild<Table>('groupTable');
  readonly filterFields = ['code', 'name'];

  applyFilter(value: string): void {
    this.groupTable()?.filterGlobal(value, 'contains');
  }

  onFiltered(rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as UserGroupDto[];
    this.selectGroup(this._reconcile(this.selectedGroup(), visible));
  }

  // ─── Group create / edit ────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form = { code: '', name: '' };

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t('ug.group.lower'),
    }));

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { code: '', name: '' };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const group = this.selectedGroup();
    if (!group) return;
    this.editingId.set(group.id);
    this.formError.set('');
    this.form = { code: group.code, name: group.name };
    this.dialogOpen.set(true);
  }

  save(): void {
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) { this.formError.set(this.i18n.t('plant.err.codeRequired')); return; }
    if (!name) { this.formError.set(this.i18n.t('plant.err.nameRequired')); return; }

    const clash = this.groups().find(
      g => g.code.toLowerCase() === code.toLowerCase() && g.id !== this.editingId(),
    );
    if (clash) { this.formError.set(this.i18n.t('plant.err.codeTaken', { code })); return; }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const request: Observable<unknown> = id
      ? this.groupApi.update(id, { code, name })
      : this.groupApi.create({ code, name });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t('ug.group.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('ug.group.lower') }));
      },
    });
  }

  askDelete(): void {
    const group = this.selectedGroup();
    if (!group) return;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('ug.group.lower') }),
      message: `${this.i18n.t('plant.confirm.message', { label: group.name })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The service clears both link tables alongside the group, so no guard is needed
      // here — unlike the other screens, nothing is left stranded.
      accept: () => this.groupApi.remove(group.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: group.name })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('ug.group.lower') }), err),
      }),
    });
  }

  // ─── Permission picker ──────────────────────────────────────────────────────

  readonly rightsOpen = signal(false);
  readonly rightsSaving = signal(false);
  readonly rightsSearch = signal('');
  /** Working copy; only written back to the server on save. */
  private readonly rightsDraft = signal<ReadonlySet<number>>(new Set());

  /** Function groups interleaved with the functions they hold, ready for a flat list. */
  readonly permissionRows = computed<PermissionRow[]>(() => {
    const groupRows = flattenTree(this.functionGroupApi.items(), (a, b) => a.code.localeCompare(b.code));
    const byGroup = new Map<number, FunctionDto[]>();
    for (const fn of this.functionApi.items()) {
      if (fn.functionGroupId == null) continue;
      const bucket = byGroup.get(fn.functionGroupId);
      bucket ? bucket.push(fn) : byGroup.set(fn.functionGroupId, [fn]);
    }

    // Descendants first so a group header can claim every function beneath it, not just
    // the ones hanging directly off it.
    const subtreeFunctions = new Map<number, number[]>();
    for (const row of [...groupRows].reverse()) {
      const own = (byGroup.get(row.id) ?? []).map(f => f.id);
      const fromChildren = groupRows
        .filter(child => child.parentId === row.id)
        .flatMap(child => subtreeFunctions.get(child.id) ?? []);
      subtreeFunctions.set(row.id, [...own, ...fromChildren]);
    }

    const rows: PermissionRow[] = [];
    for (const group of groupRows) {
      rows.push({
        kind: 'group',
        id: group.id,
        code: group.code,
        name: group.name,
        depth: group.depth,
        functionIds: subtreeFunctions.get(group.id) ?? [],
      });
      for (const fn of (byGroup.get(group.id) ?? []).sort((a, b) => a.functionCode.localeCompare(b.functionCode))) {
        rows.push({
          kind: 'function',
          id: fn.id,
          code: fn.functionCode,
          name: fn.functionName,
          depth: group.depth + 1,
          functionIds: [fn.id],
        });
      }
    }
    return rows;
  });

  /** Search keeps a group header whenever any of its functions match, so matches stay
   *  in context instead of appearing as a bare list. */
  readonly visiblePermissionRows = computed(() => {
    const term = this.rightsSearch().trim().toLowerCase();
    if (!term) return this.permissionRows();

    const rows = this.permissionRows();
    const matches = (row: PermissionRow) =>
      row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term);

    const keptGroups = new Set<number>();
    for (const row of rows) {
      if (row.kind === 'function' && matches(row)) {
        for (const group of rows) {
          if (group.kind === 'group' && group.functionIds.includes(row.id)) keptGroups.add(group.id);
        }
      }
      if (row.kind === 'group' && matches(row)) keptGroups.add(row.id);
    }

    return rows.filter(row =>
      row.kind === 'group'
        ? keptGroups.has(row.id)
        : matches(row) || rows.some(g => g.kind === 'group' && matches(g) && g.functionIds.includes(row.id)));
  });

  readonly rightsSelectedCount = computed(() => this.rightsDraft().size);

  isRowChecked(row: PermissionRow): boolean {
    const draft = this.rightsDraft();
    return row.functionIds.length > 0 && row.functionIds.every(id => draft.has(id));
  }

  isRowPartial(row: PermissionRow): boolean {
    const draft = this.rightsDraft();
    return row.kind === 'group'
      && row.functionIds.some(id => draft.has(id))
      && !row.functionIds.every(id => draft.has(id));
  }

  toggleRow(row: PermissionRow, checked: boolean): void {
    const next = new Set(this.rightsDraft());
    for (const id of row.functionIds) checked ? next.add(id) : next.delete(id);
    this.rightsDraft.set(next);
  }

  openRights(): void {
    if (!this.selectedGroup()) return;
    this.rightsSearch.set('');
    this.rightsDraft.set(new Set(this.assignedFunctionIds()));
    this.rightsOpen.set(true);
  }

  setAllRights(checked: boolean): void {
    this.rightsDraft.set(checked ? new Set(this.functionApi.items().map(f => f.id)) : new Set());
  }

  saveRights(): void {
    const group = this.selectedGroup();
    if (!group) return;

    this.rightsSaving.set(true);
    this.groupApi.setFunctionIds(group.id, [...this.rightsDraft()]).subscribe({
      next: () => {
        this.rightsSaving.set(false);
        this.rightsOpen.set(false);
        this._loadAssignments(group.id);
        this._ok(this.i18n.t('ug.ok.rights'));
      },
      error: (err: HttpErrorResponse) => {
        this.rightsSaving.set(false);
        this._fail(this.i18n.t('ug.err.rightsFailed'), err);
      },
    });
  }

  // ─── Member picker ──────────────────────────────────────────────────────────

  readonly membersOpen = signal(false);
  readonly membersSaving = signal(false);
  readonly membersSearch = signal('');
  private readonly membersDraft = signal<ReadonlySet<number>>(new Set());

  readonly visibleUsers = computed(() => {
    const term = this.membersSearch().trim().toLowerCase();
    const users = this.userApi.items();
    if (!term) return users;
    return users.filter(u =>
      u.code.toLowerCase().includes(term)
      || u.loginName.toLowerCase().includes(term)
      || u.fullName.toLowerCase().includes(term)
      || this.orgName(u.organizationId).toLowerCase().includes(term));
  });

  readonly membersSelectedCount = computed(() => this.membersDraft().size);

  isUserChecked(id: number): boolean {
    return this.membersDraft().has(id);
  }

  toggleUser(id: number, checked: boolean): void {
    const next = new Set(this.membersDraft());
    checked ? next.add(id) : next.delete(id);
    this.membersDraft.set(next);
  }

  /** Applies to the rows currently visible, so it follows the search rather than
   *  silently touching users the operator cannot see. */
  setAllVisibleUsers(checked: boolean): void {
    const next = new Set(this.membersDraft());
    for (const user of this.visibleUsers()) checked ? next.add(user.id) : next.delete(user.id);
    this.membersDraft.set(next);
  }

  openMembers(): void {
    if (!this.selectedGroup()) return;
    this.membersSearch.set('');
    this.membersDraft.set(new Set(this.assignedUserIds()));
    this.membersOpen.set(true);
  }

  saveMembers(): void {
    const group = this.selectedGroup();
    if (!group) return;

    this.membersSaving.set(true);
    this.groupApi.setUserIds(group.id, [...this.membersDraft()]).subscribe({
      next: () => {
        this.membersSaving.set(false);
        this.membersOpen.set(false);
        this._loadAssignments(group.id);
        this._ok(this.i18n.t('ug.ok.members'));
      },
      error: (err: HttpErrorResponse) => {
        this.membersSaving.set(false);
        this._fail(this.i18n.t('ug.err.membersFailed'), err);
      },
    });
  }

  /** Removes one member straight from the list, without opening the picker. */
  removeMember(user: UserDto): void {
    const group = this.selectedGroup();
    if (!group) return;

    const remaining = this.assignedUserIds().filter(id => id !== user.id);
    this.groupApi.setUserIds(group.id, remaining).subscribe({
      next: () => { this._loadAssignments(group.id); this._ok(this.i18n.t('ug.ok.members')); },
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('ug.err.membersFailed'), err),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
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
