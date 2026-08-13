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
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { FunctionApiService, FunctionGroupApiService } from '../../core/services/function-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { MenuService } from '../../core/services/menu.service';
import { FunctionDto, FunctionGroupDto } from '../../domain/models/function-dto.model';
import { MenuItem } from '../../domain/models/menu-item.model';
import { CollapsibleTree, flattenTree } from '../../shared/utils/tree-rows';

type EntityKind = 'group' | 'function';

interface EntityForm {
  code: string;
  name: string;
  description: string;
  parentId: number | null;
}

/** A group plus how deep it sits, so the flat table can indent it. */
interface GroupRow extends FunctionGroupDto {
  depth: number;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  group: 'fn.group.lower',
  function: 'fn.function.lower',
};

@Component({
  selector: 'app-function',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, SelectModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './function.component.html',
  styleUrl: './function.component.scss',
})
export class FunctionComponent extends PermissionAwarePage implements OnInit {
  private readonly groupApi = inject(FunctionGroupApiService);
  private readonly functionApi = inject(FunctionApiService);
  private readonly menuService = inject(MenuService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  /** Splitter sizes go through SecureStorageService rather than PrimeNG's own plain-text stateStorage. */
  readonly split = inject(SplitStateService);

  /**
   * Held separately because inside `<ng-template #toolbar let-perms="perms">` the context
   * variable shadows the component's `perms`, so `perms.function.add` there resolves
   * against the panel's own code set and comes back undefined. Template context variables
   * are untyped, so nothing catches that at build time.
   */
  readonly syncPerm = PERMISSIONS.function.add;

  readonly loading = computed(() => this.groupApi.loading() || this.functionApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedGroup = signal<FunctionGroupDto | null>(null);
  readonly selectedFunction = signal<FunctionDto | null>(null);

  /**
   * Groups ordered depth-first with a `depth` for indentation. A plain table rather than
   * a TreeTable: these hierarchies are short and small, and a flat list keeps the grid
   * styling shared with the other declaration screens.
   */
  readonly groupRows = computed<GroupRow[]>(() =>
    flattenTree(this.groupApi.items(), (a, b) => a.code.localeCompare(b.code)));

  // ─── Expand / collapse ──────────────────────────────────────────────────────

  /** Mirrors the group panel's search box; the term itself lives inside p-table. */
  private readonly groupSearch = signal('');

  readonly tree = new CollapsibleTree(this.groupRows, this.groupSearch);

  readonly syncing = signal(false);

  /** Seeds the codes the app enforces. Hand-typing 40-odd of them is not realistic, and
   *  a typo silently locks a feature for everyone but admins. */
  syncCatalog(): void {
    this.syncing.set(true);
    this.functionApi.syncCatalog().subscribe({
      next: result => {
        this.syncing.set(false);
        this.reload();
        const added = result.groupsCreated + result.permissionsCreated;
        this._ok(added === 0
          ? this.i18n.t('fn.sync.upToDate', { total: result.catalogSize })
          : this.i18n.t('fn.sync.done', {
              groups: result.groupsCreated,
              permissions: result.permissionsCreated,
              total: result.catalogSize,
            }));
      },
      error: (err: HttpErrorResponse) => {
        this.syncing.set(false);
        this._fail(this.i18n.t('fn.err.syncFailed'), err);
      },
    });
  }

  toggleCollapse(id: number, event: Event): void {
    // The toggle lives inside the row, which is itself a select target.
    event.stopPropagation();

    const swallowed = this.tree.toggle(id);
    // Collapsing over the current selection would leave it driving the detail panel from
    // off-screen; hand the selection to the branch that swallowed it.
    const selected = this.selectedGroup();
    if (selected && selected.id !== id && swallowed.has(selected.id)) {
      const collapsedRow = this.groupApi.items().find(g => g.id === id);
      if (collapsedRow) this.selectedGroup.set(collapsedRow);
    }
  }

  readonly functions = computed(() => {
    const groupId = this.selectedGroup()?.id;
    if (groupId == null) return [];
    return this.functionApi.items().filter(f => f.functionGroupId === groupId);
  });

  /** Permissions the backend holds with no group. No panel here can reach them. */
  readonly ungroupedCount = computed(() =>
    this.functionApi.items().filter(f => f.functionGroupId == null).length);

  /** Valid parents: every group except the one being edited and its descendants. */
  readonly parentOptions = computed(() => {
    const editing = this.dialogKind() === 'group' ? this.editingId() : null;
    const blocked = editing != null ? this.tree.descendantIds(editing) : new Set<number>();
    return [
      { label: this.i18n.t('fn.parentRoot'), value: null },
      ...this.groupRows()
        .filter(row => !blocked.has(row.id))
        .map(row => ({ label: `${'— '.repeat(row.depth)}${row.code} · ${row.name}`, value: row.id })),
    ];
  });

  constructor() {
    // No entity passed: both panels gate on their own code set, handed to the shared
    // toolbar template through ngTemplateOutlet.
    super();

    effect(() => {
      const functions = this.functions();
      untracked(() => this.selectedFunction.set(this._reconcile(this.selectedFunction(), functions)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      groups: this.groupApi.load(),
      functions: this.functionApi.load(),
      // Read-only: used to refuse deleting a permission a menu item still depends on.
      menus: this.menuService.loadCatalogue(),
    }).subscribe({
      next: () => this.selectedGroup.set(this._reconcile(this.selectedGroup(), this.groupRows())),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('fn.err.loadFailed'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly groupTable = viewChild<Table>('groupTable');
  private readonly functionTable = viewChild<Table>('functionTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    group: ['code', 'name'],
    function: ['functionCode', 'functionName'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    if (kind === 'group') this.groupSearch.set(value);
    const table = kind === 'group' ? this.groupTable() : this.functionTable();
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'group') {
      this.selectedGroup.set(this._reconcile(this.selectedGroup(), visible as FunctionGroupDto[]));
    } else {
      this.selectedFunction.set(this._reconcile(this.selectedFunction(), visible as FunctionDto[]));
    }
  }

  // ─── Selection handlers ─────────────────────────────────────────────────────

  selectGroup(group: FunctionGroupDto): void {
    if (this.selectedGroup()?.id === group.id) return;
    this.selectedGroup.set(group);
  }

  selectFunction(fn: FunctionDto): void {
    this.selectedFunction.set(fn);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('group');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = { code: '', name: '', description: '', parentId: null };

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = {
      code: '',
      name: '',
      description: '',
      // A new group defaults under whatever is selected — the common case is adding a
      // sub-group to the group you are looking at.
      parentId: kind === 'group' ? this.selectedGroup()?.id ?? null : null,
    };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = kind === 'group' ? this.selectedGroup() : this.selectedFunction();
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = kind === 'group'
      ? {
          code: (row as FunctionGroupDto).code,
          name: (row as FunctionGroupDto).name,
          description: (row as FunctionGroupDto).description ?? '',
          parentId: (row as FunctionGroupDto).parentId ?? null,
        }
      : {
          code: (row as FunctionDto).functionCode,
          name: (row as FunctionDto).functionName,
          description: '',
          parentId: null,
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
    const row = kind === 'group' ? this.selectedGroup() : this.selectedFunction();
    if (!row) return;

    const blocker = kind === 'group' ? this._groupBlocker(row.id) : this._functionBlocker(row.id);
    if (blocker) {
      this._fail(blocker);
      return;
    }

    const label = kind === 'group'
      ? (row as FunctionGroupDto).name
      : (row as FunctionDto).functionName;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => (kind === 'group' ? this.groupApi : this.functionApi).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  /** Delete is a non-cascading soft delete, so anything still pointing here is stranded. */
  private _groupBlocker(id: number): string {
    const children = this.groupApi.items().filter(g => g.parentId === id).length;
    if (children) return this.i18n.t('fn.err.hasChildren', { count: children });

    const functions = this.functionApi.items().filter(f => f.functionGroupId === id).length;
    if (functions) return this.i18n.t('fn.err.hasFunctions', { count: functions });
    return '';
  }

  /**
   * A menu item gated on a deleted permission keeps its `FunctionId`, and the backend
   * only shows FunctionId-bearing items to holders of that right — so the menu would
   * silently disappear for every non-admin instead of falling back to public.
   */
  private _functionBlocker(id: number): string {
    const users = this._flattenMenus(this.menuService.catalogue())
      .filter(item => item.functionId === String(id));
    if (!users.length) return '';

    const names = users.slice(0, 3).map(m => m.label).join(', ');
    return this.i18n.t('fn.err.usedByMenu', {
      count: users.length,
      names: users.length > 3 ? `${names}…` : names,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _flattenMenus(items: MenuItem[]): MenuItem[] {
    return items.flatMap(item => [item, ...this._flattenMenus(item.children ?? [])]);
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

    // Both codes are system-wide identifiers — `Menu.FunctionId` and any future rights
    // wiring resolve them globally, not within a group.
    const siblings: { id: number; code: string }[] = kind === 'group'
      ? this.groupApi.items().map(g => ({ id: g.id, code: g.code }))
      : this.functionApi.items().map(f => ({ id: f.id, code: f.functionCode }));

    const clash = siblings.find(
      row => row.code.toLowerCase() === code.toLowerCase() && row.id !== this.editingId(),
    );
    if (clash) return this.i18n.t('plant.err.codeTaken', { code });

    if (kind === 'function' && !this.selectedGroup()) return this.i18n.t('fn.err.pickGroup');
    return '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    const code = this.form.code.trim();
    const name = this.form.name.trim();

    if (kind === 'group') {
      const body = {
        code,
        name,
        description: this.form.description.trim() || null,
        parentId: this.form.parentId,
      };
      return id ? this.groupApi.update(id, body) : this.groupApi.create(body);
    }

    const functionGroupId = this.selectedGroup()?.id;
    if (functionGroupId == null) return null;
    const body = { functionGroupId, functionCode: code, functionName: name };
    return id ? this.functionApi.update(id, body) : this.functionApi.create(body);
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail,
      life: 5000,
    });
  }
}
