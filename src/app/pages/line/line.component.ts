import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
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
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { AreaApiService, LineApiService } from '../../core/services/master-data-api.service';
import { LINE_STATUSES, LineDto, lineStatusOf } from '../../domain/models/master-data.model';

interface LineForm {
  code: string;
  name: string;
  areaId: number | null;
  status: number | null;
  layoutImage: string;
}

/**
 * Flat declaration screen for Line.
 *
 * The same rows are editable inside `factory-structure`, where they only ever appear under
 * the area the user walked into. Here the list is scoped to nothing: a line can be found by
 * its own code without knowing which area holds it, and the area becomes a column — and a
 * filter — instead of the thing that decides what the grid contains.
 */
@Component({
  selector: 'app-line',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './line.component.html',
  styleUrl: './line.component.scss',
})
export class LineComponent extends PermissionAwarePage implements OnInit {
  private readonly api = inject(LineApiService);
  private readonly areaApi = inject(AreaApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusOf = lineStatusOf;

  /** Both requests feed the one screen, so either in flight covers the whole panel. */
  readonly loading = computed(() => this.api.loading() || this.areaApi.loading());

  /** Rebuilt on every language change so the dropdown follows the toggle. */
  readonly statuses = computed(() =>
    LINE_STATUSES.map(s => ({ ...s, label: this.i18n.t(s.labelKey) })));

  readonly areas = this.areaApi.items;

  // ─── Rows ───────────────────────────────────────────────────────────────────

  /** `null` is "every area" — the default, since this screen lists lines across the plant. */
  readonly areaFilter = signal<number | null>(null);

  readonly areaFilterOptions = computed(() => [
    { label: this.i18n.t('line.areaAny'), value: null as number | null },
    ...this.areas().map(area => ({ label: area.areaName, value: area.id as number | null })),
  ]);

  /** The same areas without the "all" entry: a line has to belong to exactly one. */
  readonly areaOptions = computed(() =>
    this.areas().map(area => ({ label: area.areaName, value: area.id })));

  /** Ordered by code, which is how the plant reads a line list. */
  readonly lines = computed(() => {
    const areaId = this.areaFilter();
    const rows = areaId == null
      ? this.api.items()
      : this.api.items().filter(line => line.areaId === areaId);
    return [...rows].sort((a, b) => a.lineCode.localeCompare(b.lineCode));
  });

  readonly selected = signal<LineDto | null>(null);

  constructor() {
    // Single-entity screen: the toolbar reads canAdd()/canEdit()/canDelete() straight off
    // the base rather than naming a code per button.
    super(PERMISSIONS.line);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    // One forkJoin: a list whose Area column cannot name its areas is worse than a reload
    // that fails loudly.
    forkJoin({ lines: this.api.load(), areas: this.areaApi.load() }).subscribe({
      next: ({ lines }) => this.selected.set(this._reconcile(this.selected(), lines)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('line.err.load'), err),
    });
  }

  filterByArea(areaId: number | null): void {
    this.areaFilter.set(areaId);
    // Swapping the list under the table changes the visible rows without raising
    // `onFilter`, which only reports the global search box.
    this.selected.set(this._reconcile(this.selected(), this.lines()));
  }

  /** Blank when the area is gone or the FK was never set, so the cell renders '—'. */
  areaLabel(areaId?: number | null): string {
    if (areaId == null) return '';
    return this.areas().find(area => area.id === areaId)?.areaName ?? '';
  }

  // ─── Filter ─────────────────────────────────────────────────────────────────

  private readonly table = viewChild<Table>('lineTable');
  readonly filterFields = ['lineCode', 'lineName'];

  applyFilter(value: string): void {
    this.table()?.filterGlobal(value, 'contains');
  }

  onFiltered(rows: unknown[] | null | undefined): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as LineDto[]));
  }

  select(row: LineDto): void {
    this.selected.set(row);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: LineForm = this._emptyForm();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t('line.lower'),
    }));

  openCreate(): void {
    // A line cannot exist outside an area, so with none declared there is nothing to add —
    // point at the screen that declares them instead of opening a dialog that cannot save.
    if (this.areas().length === 0) {
      this._fail(this.i18n.t('line.err.noAreas'));
      return;
    }

    this.editingId.set(null);
    this.formError.set('');
    // Prefilled from the filter: adding while looking at one area almost always means
    // "another line in this area".
    this.form = { ...this._emptyForm(), areaId: this.areaFilter() };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selected();
    if (!row) return;

    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      code: row.lineCode,
      name: row.lineName,
      areaId: row.areaId ?? null,
      status: row.status ?? null,
      layoutImage: row.layoutImage ?? '',
    };
    this.dialogOpen.set(true);
  }

  save(): void {
    const code = this.form.code.trim();
    if (!code) { this.formError.set(this.i18n.t('plant.err.codeRequired')); return; }

    const name = this.form.name.trim();
    if (!name) { this.formError.set(this.i18n.t('plant.err.nameRequired')); return; }

    // Line codes must be unique plant-wide, not just inside one area — the same code under
    // two areas would be indistinguishable on the floor.
    const clash = this.api.items().find(
      line => line.lineCode.toLowerCase() === code.toLowerCase() && line.id !== this.editingId());
    if (clash) { this.formError.set(this.i18n.t('plant.err.codeTaken', { code })); return; }

    // Stricter than the nullable FK: a line outside every area is unreachable from the
    // structure screen and from every picker that walks factory → area → line. Same wording
    // as the factory screen's picker, which guards the identical mistake.
    if (this.form.areaId == null) {
      this.formError.set(this.i18n.t('plant.err.pickArea'));
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const body = {
      areaId: this.form.areaId,
      lineCode: code,
      lineName: name,
      status: this.form.status,
      layoutImage: this.form.layoutImage.trim() || null,
    };
    const request: Observable<unknown> = id ? this.api.update(id, body) : this.api.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t('line.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('line.lower') }));
      },
    });
  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('line.lower') }),
      message: `${this.i18n.t('plant.confirm.message', { label: row.lineName })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // Unlike Area and MachineType there is no "still in use" guard behind this one: the API
      // deletes the row outright and whatever `machine.LineId` pointed at it is left dangling,
      // which the machine screen then renders as an empty location cell.
      accept: () => this.api.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.lineName })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('line.lower') }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm(): LineForm {
    return { code: '', name: '', areaId: null, status: null, layoutImage: '' };
  }

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
