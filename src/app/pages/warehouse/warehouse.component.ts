import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import {
  WarehouseApiService,
  WarehouseZoneApiService,
  WarehouseLocationApiService,
} from '../../core/services/warehouse-api.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  WarehouseDto, WarehouseZoneDto, WarehouseLocationDto,
  WAREHOUSE_TYPES, warehouseTypeOf,
} from '../../domain/models/warehouse.model';

type EntityKind = 'warehouse' | 'zone' | 'location';

/** One dialog serves all three levels; only the fields on show differ. */
interface EntityForm {
  code: string;
  name: string;
  description: string;
  // warehouse-specific
  factoryId: number | null;
  warehouseType: number | null;
  isActive: boolean;
  // location-specific
  maxCapacity: number | null;
  isPickingLocation: boolean;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  warehouse: 'wh.warehouse.lower',
  zone:      'wh.zone.lower',
  location:  'wh.location.lower',
};

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, InputNumberModule, SelectModule, CheckboxModule, TagModule,
    TextareaModule, TooltipModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './warehouse.component.html',
  styleUrl: './warehouse.component.scss',
})
export class WarehouseComponent implements OnInit {
  private readonly warehouseApi = inject(WarehouseApiService);
  private readonly zoneApi = inject(WarehouseZoneApiService);
  private readonly locationApi = inject(WarehouseLocationApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  readonly perms = PERMISSIONS;

  readonly typeOf = warehouseTypeOf;

  readonly warehouseTypes = computed(() =>
    WAREHOUSE_TYPES.map(t => ({ ...t, label: this.i18n.t(t.labelKey) })));

  private _noun(kind: EntityKind): string {
    return this.i18n.t(LABEL_KEYS[kind]);
  }

  readonly loading = computed(() =>
    this.warehouseApi.loading() || this.zoneApi.loading() || this.locationApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedWarehouse = signal<WarehouseDto | null>(null);
  readonly selectedZone = signal<WarehouseZoneDto | null>(null);
  readonly selectedLocation = signal<WarehouseLocationDto | null>(null);

  readonly warehouses = this.warehouseApi.items;

  readonly zones = computed(() => {
    const warehouseId = this.selectedWarehouse()?.id;
    if (warehouseId == null) return [];
    return this.zoneApi.items().filter(z => z.warehouseId === warehouseId);
  });

  readonly locations = computed(() => {
    const zoneId = this.selectedZone()?.id;
    if (zoneId == null) return [];
    return this.locationApi.items().filter(l => l.warehouseZoneId === zoneId);
  });

  constructor() {
    effect(() => {
      const zones = this.zones();
      untracked(() => this.selectedZone.set(this._reconcile(this.selectedZone(), zones)));
    });

    effect(() => {
      const locations = this.locations();
      untracked(() => this.selectedLocation.set(this._reconcile(this.selectedLocation(), locations)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      warehouses: this.warehouseApi.load(),
      zones: this.zoneApi.load(),
      locations: this.locationApi.load(),
    }).subscribe({
      next: ({ warehouses }) => this.selectedWarehouse.set(this._reconcile(this.selectedWarehouse(), warehouses)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('wh.err.loadFailed'), err),
    });
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly warehouseTable = viewChild<Table>('warehouseTable');
  private readonly zoneTable = viewChild<Table>('zoneTable');
  private readonly locationTable = viewChild<Table>('locationTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    warehouse: ['warehouseCode', 'warehouseName'],
    zone:      ['warehouseZoneCode', 'warehouseZoneName'],
    location:  ['warehouseLocationCode', 'warehouseLocationName'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = { warehouse: this.warehouseTable(), zone: this.zoneTable(), location: this.locationTable() }[kind];
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'warehouse') {
      this.selectedWarehouse.set(this._reconcile(this.selectedWarehouse(), visible as WarehouseDto[]));
    } else if (kind === 'zone') {
      this.selectedZone.set(this._reconcile(this.selectedZone(), visible as WarehouseZoneDto[]));
    } else {
      this.selectedLocation.set(this._reconcile(this.selectedLocation(), visible as WarehouseLocationDto[]));
    }
  }

  // ─── Selection handlers ─────────────────────────────────────────────────────

  selectWarehouse(warehouse: WarehouseDto): void {
    if (this.selectedWarehouse()?.id === warehouse.id) return;
    this.selectedWarehouse.set(warehouse);
  }

  selectZone(zone: WarehouseZoneDto): void {
    this.selectedZone.set(zone);
  }

  selectLocation(location: WarehouseLocationDto): void {
    this.selectedLocation.set(location);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('warehouse');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = {
    code: '', name: '', description: '',
    factoryId: null, warehouseType: null, isActive: true,
    maxCapacity: null, isPickingLocation: false,
  };

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'wh.dialog.edit' : 'wh.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = {
      code: '', name: '', description: '',
      factoryId: null, warehouseType: null, isActive: true,
      maxCapacity: null, isPickingLocation: false,
    };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = this._selected(kind);
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');

    if (kind === 'warehouse') {
      const w = row as WarehouseDto;
      this.form = {
        code: w.warehouseCode, name: w.warehouseName, description: w.description ?? '',
        factoryId: w.factoryId ?? null, warehouseType: w.warehouseType ?? null,
        isActive: w.isActive ?? true,
        maxCapacity: null, isPickingLocation: false,
      };
    } else if (kind === 'zone') {
      const z = row as WarehouseZoneDto;
      this.form = {
        code: z.warehouseZoneCode, name: z.warehouseZoneName, description: z.description ?? '',
        factoryId: null, warehouseType: null, isActive: true,
        maxCapacity: null, isPickingLocation: false,
      };
    } else {
      const l = row as WarehouseLocationDto;
      this.form = {
        code: l.warehouseLocationCode, name: l.warehouseLocationName, description: '',
        factoryId: null, warehouseType: null, isActive: l.isActive ?? true,
        maxCapacity: l.maxCapacity ?? null, isPickingLocation: l.isPickingLocation ?? false,
      };
    }

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
        this._ok(this.i18n.t(id ? 'wh.ok.updated' : 'wh.ok.created', { entity: this._noun(kind) }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message || err.error
          || this.i18n.t('wh.err.saveFailed', { entity: this._noun(kind) }));
      },
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  askDelete(kind: EntityKind): void {
    const row = this._selected(kind);
    if (!row) return;

    const blocker = this._childBlocker(kind, row.id);
    if (blocker) {
      this._fail(blocker);
      return;
    }

    const label = this._nameOf(kind, row);
    this.confirm.confirm({
      header: this.i18n.t('wh.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('wh.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this._apiFor(kind).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('wh.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('wh.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  private _childBlocker(kind: EntityKind, id: number): string {
    if (kind === 'warehouse') {
      const count = this.zoneApi.items().filter(z => z.warehouseId === id).length;
      return count ? this.i18n.t('wh.err.hasZones', { count }) : '';
    }
    if (kind === 'zone') {
      const count = this.locationApi.items().filter(l => l.warehouseZoneId === id).length;
      return count ? this.i18n.t('wh.err.hasLocations', { count }) : '';
    }
    return '';
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _apiFor(kind: EntityKind) {
    return { warehouse: this.warehouseApi, zone: this.zoneApi, location: this.locationApi }[kind];
  }

  private _selected(kind: EntityKind): WarehouseDto | WarehouseZoneDto | WarehouseLocationDto | null {
    return { warehouse: this.selectedWarehouse(), zone: this.selectedZone(), location: this.selectedLocation() }[kind];
  }

  private _codeOf(kind: EntityKind, row: WarehouseDto | WarehouseZoneDto | WarehouseLocationDto): string {
    if (kind === 'warehouse') return (row as WarehouseDto).warehouseCode;
    if (kind === 'zone') return (row as WarehouseZoneDto).warehouseZoneCode;
    return (row as WarehouseLocationDto).warehouseLocationCode;
  }

  private _nameOf(kind: EntityKind, row: WarehouseDto | WarehouseZoneDto | WarehouseLocationDto): string {
    if (kind === 'warehouse') return (row as WarehouseDto).warehouseName;
    if (kind === 'zone') return (row as WarehouseZoneDto).warehouseZoneName;
    return (row as WarehouseLocationDto).warehouseLocationName;
  }

  private _siblings(kind: EntityKind): (WarehouseDto | WarehouseZoneDto | WarehouseLocationDto)[] {
    return { warehouse: this.warehouses(), zone: this.zones(), location: this.locations() }[kind];
  }

  private _validate(kind: EntityKind): string {
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) return this.i18n.t('wh.err.codeRequired');
    if (!name) return this.i18n.t('wh.err.nameRequired');

    const clash = this._siblings(kind).find(
      row => this._codeOf(kind, row).toLowerCase() === code.toLowerCase() && row.id !== this.editingId(),
    );
    if (clash) return this.i18n.t('wh.err.codeTaken', { code });

    if (kind === 'zone' && !this.selectedWarehouse()) return this.i18n.t('wh.err.pickWarehouse');
    if (kind === 'location' && !this.selectedZone()) return this.i18n.t('wh.err.pickZone');
    return '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    const description = this.form.description.trim();

    if (kind === 'warehouse') {
      const body = {
        factoryId: this.form.factoryId,
        warehouseCode: code,
        warehouseName: name,
        warehouseType: this.form.warehouseType,
        isActive: this.form.isActive,
        description,
      };
      return id ? this.warehouseApi.update(id, body) : this.warehouseApi.create(body);
    }

    if (kind === 'zone') {
      const warehouseId = this.selectedWarehouse()?.id;
      if (warehouseId == null) return null;
      const body = {
        warehouseId,
        warehouseZoneCode: code,
        warehouseZoneName: name,
        description,
      };
      return id ? this.zoneApi.update(id, body) : this.zoneApi.create(body);
    }

    const warehouseZoneId = this.selectedZone()?.id;
    if (warehouseZoneId == null) return null;
    const body = {
      warehouseZoneId,
      warehouseLocationCode: code,
      warehouseLocationName: name,
      maxCapacity: this.form.maxCapacity,
      isPickingLocation: this.form.isPickingLocation,
      isActive: this.form.isActive,
    };
    return id ? this.locationApi.update(id, body) : this.locationApi.create(body);
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err?.error?.message || err?.error || detail,
      life: 4000,
    });
  }
}
