import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TreeTableModule } from 'primeng/treetable';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { FunctionApiService } from '../../core/services/function-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { MAX_MENU_DEPTH, MenuFormValue, MenuService } from '../../core/services/menu.service';
import { MenuItem } from '../../domain/models/menu-item.model';
import { IconComponent } from '../../shared/components/icon.component';
import { ICONS } from '../../shared/menu-icons';

type TypeFilter = 'all' | 'group' | 'page';

/** A catalogue item plus the bits the table needs but the model doesn't carry. */
interface MenuRow extends MenuItem {
  depth: number;
  /** Position among its own siblings — drives the enabled state of ↑/↓. */
  index: number;
  siblingCount: number;
  /** Nested deeper than the sidebar can draw, so users will never see it. */
  unreachable: boolean;
  /** `parentId` points at an item that no longer exists. */
  orphaned: boolean;
}

@Component({
  selector: 'app-menu-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconComponent,
    TreeTableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, SelectButtonModule, IconFieldModule, InputIconModule,
    TagModule, TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './menu-manager.component.html',
  styleUrl: './menu-manager.component.scss',
})
export class MenuManagerComponent extends PermissionAwarePage implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly functionApi = inject(FunctionApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly loading = this.menuService.catalogueLoading;
  readonly maxDepth = MAX_MENU_DEPTH;

  readonly search = signal('');
  readonly typeFilter = signal<TypeFilter>('all');
  readonly typeFilters = [
    { labelKey: 'menu.filter.all', value: 'all' as const },
    { labelKey: 'menu.filter.group', value: 'group' as const },
    { labelKey: 'menu.filter.page', value: 'page' as const },
  ];

  /** Icon presets offered next to the free-text icon field. */
  readonly iconPresets = Object.entries(ICONS).map(([name, markup]) => ({ name, markup }));

  // ─── Form state ─────────────────────────────────────────────────────────────
  readonly dialogOpen = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly formError = signal('');

  form: MenuFormValue = this._emptyForm();

  // ─── Derived views ──────────────────────────────────────────────────────────

  private readonly rows = computed(() => this._decorate(this.menuService.catalogue()));

  readonly nodes = computed(() => this._toNodes(this._filter(this.rows())));

  readonly stats = computed(() => {
    const flat = this._flatten(this.rows());
    return {
      total: flat.length,
      groups: flat.filter(r => !r.route).length,
      pages: flat.filter(r => !!r.route).length,
      secured: flat.filter(r => !!r.functionId).length,
      problems: flat.filter(r => r.unreachable || r.orphaned).length,
    };
  });

  /** Valid parents: top-level items that hold no route of their own. Restricting to
   *  level 1 keeps every new item inside the two levels the sidebar can render, and
   *  excluding routed items stops an already-clickable page turning into a dead header. */
  readonly parentOptions = computed(() => {
    const editing = this.editingId();
    const blocked = editing ? this.menuService.descendantIds(editing) : new Set<string>();
    const currentParentId = editing ? this.menuService.findById(editing)?.parentId : undefined;

    return [
      { label: this.i18n.t('menu.field.parentRoot'), value: null },
      ...this.menuService.catalogue()
        // Legacy rows can sit under a parent these rules would no longer allow. Keeping
        // that parent in the list stops the dropdown falling back to blank and quietly
        // moving the item to the root on the next save.
        .filter(item => (!item.route && !blocked.has(item.id)) || item.id === currentParentId)
        .map(item => ({ label: item.label, value: item.id })),
    ];
  });

  readonly functionOptions = computed(() => [
    { label: this.i18n.t('menu.field.functionPublic'), value: null },
    ...this.functionApi.items().map(fn => ({
      label: `${fn.functionCode} — ${fn.functionName}`,
      value: String(fn.id),
    })),
  ]);

  constructor() {
    // Single-entity screen: the toolbar and the per-row actions read canAdd()/canEdit()/
    // canDelete() straight off the base rather than naming a code per button.
    super(PERMISSIONS.menu);
  }

  ngOnInit(): void {
    this.reload();
    // A missing function catalogue only costs the dropdown its options, so it must
    // not take the whole screen down with it.
    this.functionApi.load().subscribe({ error: () => {} });
  }

  reload(): void {
    this.menuService.loadCatalogue().subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('menu.err.loadFailed'), err),
    });
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  openCreate(parentId: string | null = null): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), parentId };
    this.dialogOpen.set(true);
  }

  openEdit(item: MenuItem): void {
    this.editingId.set(item.id);
    this.formError.set('');
    this.form = {
      label: item.label,
      route: item.route ?? '',
      icon: item.icon ?? '',
      parentId: item.parentId ?? null,
      functionId: item.functionId ?? null,
    };
    this.dialogOpen.set(true);
  }

  applyIconPreset(markup: string): void {
    this.form = { ...this.form, icon: markup };
  }

  save(): void {
    const error = this._validate();
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    const id = this.editingId();
    const request = id ? this.menuService.update(id, this.form) : this.menuService.create(this.form);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this._ok(this.i18n.t(id ? 'menu.ok.updated' : 'menu.ok.created'));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this._message(err, this.i18n.t('menu.err.saveFailed')));
      },
    });
  }

  // ─── Row actions ────────────────────────────────────────────────────────────

  move(row: MenuRow, delta: -1 | 1): void {
    this.menuService.move(row.id, delta).subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('menu.err.orderFailed'), err),
    });
  }

  askDelete(row: MenuRow): void {
    // The API deletes one row and leaves children pointing at a parent that is gone;
    // they'd resurface at the root here but disappear from every user's sidebar.
    if (row.children?.length) {
      this._fail(this.i18n.t('menu.err.hasChildrenDelete', {
        label: row.label,
        count: row.children.length,
      }));
      return;
    }

    this.confirm.confirm({
      header: this.i18n.t('menu.confirm.title'),
      message: `${this.i18n.t('menu.confirm.message', { label: row.label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.menuService.remove(row.id).subscribe({
        next: () => this._ok(this.i18n.t('menu.ok.deleted', { label: row.label })),
        error: (err: HttpErrorResponse) => this._fail(this.i18n.t('menu.err.deleteFailed'), err),
      }),
    });
  }

  /** Only level-1 groups can take children — see `parentOptions`. */
  canAddChild(row: MenuRow): boolean {
    return row.depth === 1 && !row.route;
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm(): MenuFormValue {
    return { label: '', route: '', icon: '', parentId: null, functionId: null };
  }

  private _validate(): string {
    if (!this.form.label?.trim()) return this.i18n.t('menu.err.labelRequired');

    const route = this.form.route?.trim();
    if (route) {
      const normalised = route.startsWith('/') ? route : `/${route}`;
      const clash = this._flatten(this.rows()).find(
        row => row.route === normalised && row.id !== this.editingId(),
      );
      if (clash) return this.i18n.t('menu.err.routeTaken', { route: normalised, label: clash.label });
    }

    const editing = this.editingId();
    if (editing) {
      const item = this.menuService.findById(editing);
      // A routed item that already has children would lose its own click target.
      if (route && item?.children?.length) return this.i18n.t('menu.err.hasChildrenRoute');
      if (this.form.parentId && item?.children?.length) return this.i18n.t('menu.err.hasChildrenParent');
    }
    return '';
  }

  /** Walks the tree once, attaching depth/position/health flags to every node. */
  private _decorate(items: MenuItem[], depth = 1): MenuRow[] {
    return items.map((item, index) => ({
      ...item,
      depth,
      index,
      siblingCount: items.length,
      unreachable: depth > MAX_MENU_DEPTH,
      // buildTree() lifts items whose parent is gone up to the root, keeping their
      // stale parentId — that pairing is what marks them as orphaned.
      orphaned: depth === 1 && !!item.parentId,
      children: item.children?.length ? this._decorate(item.children, depth + 1) : undefined,
    }));
  }

  private _flatten(rows: MenuRow[]): MenuRow[] {
    return rows.flatMap(row => [row, ...this._flatten((row.children ?? []) as MenuRow[])]);
  }

  /** Keeps a row when it matches, and keeps its ancestors so matches stay reachable. */
  private _filter(rows: MenuRow[]): MenuRow[] {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    if (!term && type === 'all') return rows;

    const matches = (row: MenuRow) => {
      const byTerm = !term
        || row.label.toLowerCase().includes(term)
        || (row.route ?? '').toLowerCase().includes(term);
      const byType = type === 'all' || (type === 'group' ? !row.route : !!row.route);
      return byTerm && byType;
    };

    const walk = (nodes: MenuRow[]): MenuRow[] =>
      nodes.reduce<MenuRow[]>((kept, node) => {
        const children = walk((node.children ?? []) as MenuRow[]);
        if (matches(node) || children.length) {
          kept.push({ ...node, children: children.length ? children : undefined });
        }
        return kept;
      }, []);

    return walk(rows);
  }

  private _toNodes(rows: MenuRow[]): TreeNode<MenuRow>[] {
    return rows.map(row => ({
      key: row.id,
      data: row,
      // Expanded by default: an admin screen is for seeing the whole structure at once.
      expanded: true,
      leaf: !row.children?.length,
      children: this._toNodes((row.children ?? []) as MenuRow[]),
    }));
  }

  private _message(err: HttpErrorResponse, fallback: string): string {
    return err.error?.message || fallback;
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err ? this._message(err, detail) : detail,
      life: 4000,
    });
  }
}
