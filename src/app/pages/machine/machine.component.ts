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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { MachineApiService, MachineTypeApiService } from '../../core/services/equipment-api.service';
import { AreaApiService, LineApiService } from '../../core/services/master-data-api.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  MachineDto, MachineTypeDto, MACHINE_STATUSES, machineStatusOf,
} from '../../domain/models/equipment.model';

type EntityKind = 'type' | 'machine';

interface EntityForm {
  code: string;
  name: string;
  status: number | null;
  lineId: number | null;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  type: 'machine.type.lower',
  machine: 'machine.machine.lower',
};

@Component({
  selector: 'app-machine',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './machine.component.html',
  styleUrl: './machine.component.scss',
})
export class MachineComponent extends PermissionAwarePage implements OnInit {
  private readonly typeApi = inject(MachineTypeApiService);
  private readonly machineApi = inject(MachineApiService);
  private readonly lineApi = inject(LineApiService);
  private readonly areaApi = inject(AreaApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  /** Splitter sizes go through SecureStorageService rather than PrimeNG's own plain-text stateStorage. */
  readonly split = inject(SplitStateService);

  readonly statusOf = machineStatusOf;

  readonly loading = computed(() => this.typeApi.loading() || this.machineApi.loading());

  readonly statuses = computed(() =>
    MACHINE_STATUSES.map(s => ({ ...s, label: this.i18n.t(s.labelKey) })));

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedType = signal<MachineTypeDto | null>(null);
  readonly selectedMachine = signal<MachineDto | null>(null);

  readonly types = this.typeApi.items;

  /** Machines classified under the selected type. Machines with no type at all never
   *  appear here — see `untypedCount` for how that is surfaced. */
  readonly machines = computed(() => {
    const typeId = this.selectedType()?.id;
    if (typeId == null) return [];
    return this.machineApi.items().filter(m => m.machineTypeId === typeId);
  });

  /** Machines the backend holds with `machineTypeId` null. They belong to no type, so
   *  no panel here would ever show them — worth flagging rather than losing silently. */
  readonly untypedCount = computed(() =>
    this.machineApi.items().filter(m => m.machineTypeId == null).length);

  // ─── Line lookup ────────────────────────────────────────────────────────────

  /** "Area / Line" for a line id — a bare line name is rarely unique across areas. */
  lineLabel(lineId?: number | null): string {
    if (lineId == null) return '';
    const line = this.lineApi.items().find(l => l.id === lineId);
    if (!line) return '';
    const area = this.areaApi.items().find(a => a.id === line.areaId);
    return area ? `${area.areaName} / ${line.lineName}` : line.lineName;
  }

  readonly lineOptions = computed(() => [
    { label: this.i18n.t('machine.lineUnset'), value: null },
    ...this.lineApi.items().map(line => ({ label: this.lineLabel(line.id), value: line.id })),
  ]);

  constructor() {
    // No entity passed: both panels gate on their own code set, handed to the shared
    // toolbar template through ngTemplateOutlet.
    super();

    // Keep the detail selection on a row that is actually on screen, and re-point it at
    // the freshly loaded object after a reload so the edit form never reads stale values.
    effect(() => {
      const machines = this.machines();
      untracked(() => this.selectedMachine.set(this._reconcile(this.selectedMachine(), machines)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      types: this.typeApi.load(),
      machines: this.machineApi.load(),
      // Lines and areas are read-only here: they only supply the line picker and the
      // "Area / Line" column.
      lines: this.lineApi.load(),
      areas: this.areaApi.load(),
    }).subscribe({
      next: ({ types }) => this.selectedType.set(this._reconcile(this.selectedType(), types)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('machine.err.loadFailed'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly typeTable = viewChild<Table>('typeTable');
  private readonly machineTable = viewChild<Table>('machineTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    type: ['machineTypeCode', 'machineTypeName'],
    machine: ['machineCode', 'machineName'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = kind === 'type' ? this.typeTable() : this.machineTable();
    table?.filterGlobal(value, 'contains');
  }

  /** The table filters its own rows without telling the page, so a selection that was
   *  just filtered out would keep driving the detail panel from off-screen. */
  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'type') {
      this.selectedType.set(this._reconcile(this.selectedType(), visible as MachineTypeDto[]));
    } else {
      this.selectedMachine.set(this._reconcile(this.selectedMachine(), visible as MachineDto[]));
    }
  }

  // ─── Selection handlers ─────────────────────────────────────────────────────

  selectType(type: MachineTypeDto): void {
    if (this.selectedType()?.id === type.id) return;
    this.selectedType.set(type);
  }

  selectMachine(machine: MachineDto): void {
    this.selectedMachine.set(machine);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('type');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = { code: '', name: '', status: null, lineId: null };

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = { code: '', name: '', status: kind === 'machine' ? 1 : null, lineId: null };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = kind === 'type' ? this.selectedType() : this.selectedMachine();
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = kind === 'type'
      ? {
          code: (row as MachineTypeDto).machineTypeCode,
          name: (row as MachineTypeDto).machineTypeName,
          status: null,
          lineId: null,
        }
      : {
          code: (row as MachineDto).machineCode,
          name: (row as MachineDto).machineName,
          status: (row as MachineDto).status ?? null,
          lineId: (row as MachineDto).lineId ?? null,
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
    const row = kind === 'type' ? this.selectedType() : this.selectedMachine();
    if (!row) return;

    // Delete is a non-cascading soft delete: machines would keep pointing at a type
    // that reads as gone, dropping them out of every panel here.
    if (kind === 'type') {
      const count = this.machineApi.items().filter(m => m.machineTypeId === row.id).length;
      if (count) {
        this._fail(this.i18n.t('machine.err.hasMachines', { count }));
        return;
      }
    }

    const label = kind === 'type'
      ? (row as MachineTypeDto).machineTypeName
      : (row as MachineDto).machineName;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => (kind === 'type' ? this.typeApi : this.machineApi).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

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

    const siblings: { id: number; code: string }[] = kind === 'type'
      ? this.types().map(t => ({ id: t.id, code: t.machineTypeCode }))
      // Machine codes must be unique plant-wide, not just inside the selected type —
      // the same code under two types would be indistinguishable on the floor.
      : this.machineApi.items().map(m => ({ id: m.id, code: m.machineCode }));

    const clash = siblings.find(
      row => row.code.toLowerCase() === code.toLowerCase() && row.id !== this.editingId(),
    );
    if (clash) return this.i18n.t('plant.err.codeTaken', { code });

    if (kind === 'machine' && !this.selectedType()) return this.i18n.t('machine.err.pickType');
    return '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    const code = this.form.code.trim();
    const name = this.form.name.trim();

    if (kind === 'type') {
      const body = { machineTypeCode: code, machineTypeName: name };
      return id ? this.typeApi.update(id, body) : this.typeApi.create(body);
    }

    const machineTypeId = this.selectedType()?.id;
    if (machineTypeId == null) return null;
    const body = {
      machineTypeId,
      lineId: this.form.lineId,
      machineCode: code,
      machineName: name,
      status: this.form.status,
    };
    return id ? this.machineApi.update(id, body) : this.machineApi.create(body);
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
