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
import { TooltipModule } from 'primeng/tooltip';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { AreaApiService, FactoryApiService, LineApiService } from '../../core/services/master-data-api.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  AreaDto, FactoryDto, LineDto, LINE_STATUSES, lineStatusOf,
} from '../../domain/models/master-data.model';

type EntityKind = 'factory' | 'area' | 'line';

/** One dialog serves all three levels; only the fields on show differ. */
interface EntityForm {
  code: string;
  name: string;
  status: number | null;
  layoutImage: string;
}

/** Lower-case entity noun, interpolated into messages like "Could not save the {entity}". */
const LABEL_KEYS: Record<EntityKind, string> = {
  factory: 'plant.factory.lower',
  area: 'plant.area.lower',
  line: 'plant.line.lower',
};

@Component({
  selector: 'app-factory-structure',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule, TooltipModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './factory-structure.component.html',
  styleUrl: './factory-structure.component.scss',
})
export class FactoryStructureComponent extends PermissionAwarePage implements OnInit {
  private readonly factoryApi = inject(FactoryApiService);
  private readonly areaApi = inject(AreaApiService);
  private readonly lineApi = inject(LineApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  /** Splitter sizes go through SecureStorageService rather than PrimeNG's own plain-text stateStorage. */
  readonly split = inject(SplitStateService);

  readonly statusOf = lineStatusOf;

  /** Rebuilt on every language change so the dropdown follows the toggle. */
  readonly lineStatuses = computed(() =>
    LINE_STATUSES.map(s => ({ ...s, label: this.i18n.t(s.labelKey) })));

  /** Lower-case noun for the entity a message is about. */
  private _noun(kind: EntityKind): string {
    return this.i18n.t(LABEL_KEYS[kind]);
  }

  readonly loading = computed(() =>
    this.factoryApi.loading() || this.areaApi.loading() || this.lineApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedFactory = signal<FactoryDto | null>(null);
  readonly selectedArea = signal<AreaDto | null>(null);
  readonly selectedLine = signal<LineDto | null>(null);

  readonly factories = this.factoryApi.items;

  /** Areas of the selected factory. Empty (not "all areas") when nothing is picked —
   *  a detail panel showing unrelated rows is worse than showing none. */
  readonly areas = computed(() => {
    const factoryId = this.selectedFactory()?.id;
    if (factoryId == null) return [];
    return this.areaApi.items().filter(a => a.factoryId === factoryId);
  });

  readonly lines = computed(() => {
    const areaId = this.selectedArea()?.id;
    if (areaId == null) return [];
    return this.lineApi.items().filter(l => l.areaId === areaId);
  });

  constructor() {
    // No entity passed: the three panels each gate on their own code set, handed to the
    // shared toolbar template through ngTemplateOutlet.
    super();

    // Keep the two detail selections on a row that is actually on screen: re-point at
    // the freshly loaded object when the row survived a reload (matching on id alone
    // would leave the stale instance behind and the edit form would read old values),
    // otherwise fall back to the first row.
    effect(() => {
      const areas = this.areas();
      untracked(() => this.selectedArea.set(this._reconcile(this.selectedArea(), areas)));
    });

    effect(() => {
      const lines = this.lines();
      untracked(() => this.selectedLine.set(this._reconcile(this.selectedLine(), lines)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      factories: this.factoryApi.load(),
      areas: this.areaApi.load(),
      lines: this.lineApi.load(),
    }).subscribe({
      next: ({ factories }) => this.selectedFactory.set(this._reconcile(this.selectedFactory(), factories)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('plant.err.loadFailed'), err),
    });
  }

  /** Re-resolves a selection against a newly loaded list, defaulting to its first row. */
  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly factoryTable = viewChild<Table>('factoryTable');
  private readonly areaTable = viewChild<Table>('areaTable');
  private readonly lineTable = viewChild<Table>('lineTable');

  /** Fields each panel's search box matches against. */
  readonly filterFields: Record<EntityKind, string[]> = {
    factory: ['factoryCode', 'factoryName'],
    area: ['areaCode', 'areaName'],
    line: ['lineCode', 'lineName'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = { factory: this.factoryTable(), area: this.areaTable(), line: this.lineTable() }[kind];
    table?.filterGlobal(value, 'contains');
  }

  /**
   * The table filters its own rows without telling the rest of the page, so a selection
   * that just got filtered out would keep driving the detail panels from off-screen.
   * Re-point it at what's actually visible.
   */
  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'factory') {
      this.selectedFactory.set(this._reconcile(this.selectedFactory(), visible as FactoryDto[]));
    } else if (kind === 'area') {
      this.selectedArea.set(this._reconcile(this.selectedArea(), visible as AreaDto[]));
    } else {
      this.selectedLine.set(this._reconcile(this.selectedLine(), visible as LineDto[]));
    }
  }

  // ─── Selection handlers ─────────────────────────────────────────────────────

  selectFactory(factory: FactoryDto): void {
    if (this.selectedFactory()?.id === factory.id) return;
    this.selectedFactory.set(factory);
    // The effects above pick the first area/line of the new factory.
  }

  selectArea(area: AreaDto): void {
    this.selectedArea.set(area);
  }

  selectLine(line: LineDto): void {
    this.selectedLine.set(line);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('factory');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = { code: '', name: '', status: null, layoutImage: '' };

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = { code: '', name: '', status: kind === 'line' ? 1 : null, layoutImage: '' };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = this._selected(kind);
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      code: this._codeOf(kind, row),
      name: this._nameOf(kind, row),
      status: kind === 'line' ? (row as LineDto).status ?? null : null,
      layoutImage: kind === 'line' ? (row as LineDto).layoutImage ?? '' : '',
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
    const row = this._selected(kind);
    if (!row) return;

    // Delete is a non-cascading soft delete on the backend: children keep pointing at a
    // parent that reads as gone, which drops them out of every filtered list here.
    const blocker = this._childBlocker(kind, row.id);
    if (blocker) {
      this._fail(blocker);
      return;
    }

    const label = this._nameOf(kind, row);
    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this._apiFor(kind).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  private _childBlocker(kind: EntityKind, id: number): string {
    if (kind === 'factory') {
      const count = this.areaApi.items().filter(a => a.factoryId === id).length;
      return count ? this.i18n.t('plant.err.hasAreas', { count }) : '';
    }
    if (kind === 'area') {
      const count = this.lineApi.items().filter(l => l.areaId === id).length;
      return count ? this.i18n.t('plant.err.hasLines', { count }) : '';
    }
    return '';
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _apiFor(kind: EntityKind) {
    return { factory: this.factoryApi, area: this.areaApi, line: this.lineApi }[kind];
  }

  private _selected(kind: EntityKind): FactoryDto | AreaDto | LineDto | null {
    return { factory: this.selectedFactory(), area: this.selectedArea(), line: this.selectedLine() }[kind];
  }

  private _codeOf(kind: EntityKind, row: FactoryDto | AreaDto | LineDto): string {
    if (kind === 'factory') return (row as FactoryDto).factoryCode;
    if (kind === 'area') return (row as AreaDto).areaCode;
    return (row as LineDto).lineCode;
  }

  private _nameOf(kind: EntityKind, row: FactoryDto | AreaDto | LineDto): string {
    if (kind === 'factory') return (row as FactoryDto).factoryName;
    if (kind === 'area') return (row as AreaDto).areaName;
    return (row as LineDto).lineName;
  }

  private _siblings(kind: EntityKind): (FactoryDto | AreaDto | LineDto)[] {
    return { factory: this.factories(), area: this.areas(), line: this.lines() }[kind];
  }

  private _validate(kind: EntityKind): string {
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) return this.i18n.t('plant.err.codeRequired');
    if (!name) return this.i18n.t('plant.err.nameRequired');

    const clash = this._siblings(kind).find(
      row => this._codeOf(kind, row).toLowerCase() === code.toLowerCase() && row.id !== this.editingId(),
    );
    if (clash) return this.i18n.t('plant.err.codeTaken', { code });

    if (kind === 'area' && !this.selectedFactory()) return this.i18n.t('plant.err.pickFactory');
    if (kind === 'line' && !this.selectedArea()) return this.i18n.t('plant.err.pickArea');
    return '';
  }

  /** Builds the typed payload for the entity being edited. Every field goes on the wire —
   *  the backend overwrites the whole row from the request. */
  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    const code = this.form.code.trim();
    const name = this.form.name.trim();

    if (kind === 'factory') {
      const body = { factoryCode: code, factoryName: name };
      return id ? this.factoryApi.update(id, body) : this.factoryApi.create(body);
    }

    if (kind === 'area') {
      const factoryId = this.selectedFactory()?.id;
      if (factoryId == null) return null;
      const body = { factoryId, areaCode: code, areaName: name };
      return id ? this.areaApi.update(id, body) : this.areaApi.create(body);
    }

    const areaId = this.selectedArea()?.id;
    if (areaId == null) return null;
    const body = {
      areaId,
      lineCode: code,
      lineName: name,
      status: this.form.status,
      layoutImage: this.form.layoutImage.trim() || null,
    };
    return id ? this.lineApi.update(id, body) : this.lineApi.create(body);
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail,
      life: 4000,
    });
  }
}
