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
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import {
  UnitApiService, UnitCategoryApiService, UnitConversionApiService,
} from '../../core/services/product-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import {
  FORMULA_TYPES, UnitCategoryDto, UnitConversionDto, UnitDto, conversionFactor,
} from '../../domain/models/product.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

type EntityKind = 'category' | 'unit' | 'conversion';

interface EntityForm {
  code: string;
  name: string;
  description: string;
  symbol: string;
  decimalPlaces: number | null;
  isBaseUnit: boolean;
  isActive: boolean;
  toUnitId: number | null;
  multiplyValue: number | null;
  divideValue: number | null;
  formulaType: number;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  category: 'unit.category.lower',
  unit: 'unit.unit.lower',
  conversion: 'unit.conversion.lower',
};

@Component({
  selector: 'app-unit',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, SelectModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './unit.component.html',
  styleUrl: './unit.component.scss',
})
export class UnitComponent extends PermissionAwarePage implements OnInit {
  private readonly categoryApi = inject(UnitCategoryApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly conversionApi = inject(UnitConversionApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  readonly factorOf = conversionFactor;

  readonly loading = computed(() => this.categoryApi.loading() || this.unitApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedCategory = signal<UnitCategoryDto | null>(null);
  readonly selectedUnit = signal<UnitDto | null>(null);
  readonly selectedConversion = signal<UnitConversionDto | null>(null);

  readonly categories = this.categoryApi.items;

  readonly units = computed(() => {
    const categoryId = this.selectedCategory()?.id;
    if (categoryId == null) return [];
    return this.unitApi.items().filter(u => u.unitCategoryId === categoryId);
  });

  /**
   * Conversions that start at the selected unit. Only one direction is listed: a row is
   * declared from a source unit, and showing the reverse rows here too would make it look
   * as if the unit owned conversions it does not.
   */
  readonly conversions = computed(() => {
    const unitId = this.selectedUnit()?.id;
    if (unitId == null) return [];
    return this.conversionApi.items().filter(c => c.fromUnitId === unitId);
  });

  /** Units the backend holds with no category. No panel here can reach them. */
  readonly unassignedUnits = computed(() =>
    this.unitApi.items().filter(u => u.unitCategoryId == null).length);

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? `${unit.unitCode}${unit.symbol ? ` (${unit.symbol})` : ''}` : '';
  }

  /** Target units for a conversion: everything except the source itself. */
  readonly toUnitOptions = computed(() => {
    const fromId = this.selectedUnit()?.id;
    return this.unitApi.items()
      .filter(u => u.id !== fromId)
      .map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id }));
  });

  readonly formulaOptions = computed(() =>
    FORMULA_TYPES.map(f => ({ label: this.i18n.t(f.labelKey), value: f.value })));

  constructor() {
    // No entity passed: the three panels each gate on their own code set, handed to the
    // shared toolbar template through ngTemplateOutlet.
    super();

    effect(() => {
      const units = this.units();
      untracked(() => this.selectedUnit.set(this._reconcile(this.selectedUnit(), units)));
    });
    effect(() => {
      const conversions = this.conversions();
      untracked(() => this.selectedConversion.set(this._reconcile(this.selectedConversion(), conversions)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      categories: this.categoryApi.load(),
      units: this.unitApi.load(),
      conversions: this.conversionApi.load(),
    }).subscribe({
      next: ({ categories }) => this.selectedCategory.set(this._reconcile(this.selectedCategory(), categories)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('unit.err.load'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly categoryTable = viewChild<Table>('categoryTable');
  private readonly unitTable = viewChild<Table>('unitTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    category: ['unitCategoryCode', 'unitCategoryName', 'description'],
    unit: ['unitCode', 'unitName', 'symbol'],
    conversion: [],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = kind === 'category' ? this.categoryTable() : this.unitTable();
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'category') {
      this.selectedCategory.set(this._reconcile(this.selectedCategory(), visible as UnitCategoryDto[]));
    } else if (kind === 'unit') {
      this.selectedUnit.set(this._reconcile(this.selectedUnit(), visible as UnitDto[]));
    }
  }

  selectCategory(row: UnitCategoryDto): void {
    if (this.selectedCategory()?.id === row.id) return;
    this.selectedCategory.set(row);
  }

  selectUnit(row: UnitDto): void {
    this.selectedUnit.set(row);
  }

  selectConversion(row: UnitConversionDto): void {
    this.selectedConversion.set(row);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('category');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = this._emptyForm();
  /** Mirrors the ratio fields so the live preview recomputes while they are typed. */
  private readonly ratio = signal({ multiply: 1, divide: 1, formula: 1 });

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t(LABEL_KEYS[this.dialogKind()]),
    }));

  /** "1 kg = 1000 g", recomputed as the operator types, so a wrong ratio is obvious. */
  readonly conversionPreview = computed(() => {
    if (this.dialogKind() !== 'conversion') return null;
    const { multiply, divide, formula } = this.ratio();
    if (!divide) return null;

    const factor = conversionFactor({
      id: 0, formulaType: formula, isActive: true,
      multiplyValue: multiply, divideValue: divide,
    });
    if (factor === null || !Number.isFinite(factor)) return null;

    return {
      from: this.unitLabel(this.selectedUnit()?.id),
      to: this.unitLabel(this.form.toUnitId),
      factor,
    };
  });

  onRatioChange(): void {
    this.ratio.set({
      multiply: this.form.multiplyValue ?? 1,
      divide: this.form.divideValue ?? 1,
      formula: this.form.formulaType,
    });
  }

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = this._emptyForm();
    this.onRatioChange();
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = {
      category: this.selectedCategory(), unit: this.selectedUnit(), conversion: this.selectedConversion(),
    }[kind];
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');

    if (kind === 'category') {
      const c = row as UnitCategoryDto;
      this.form = {
        ...this._emptyForm(),
        code: c.unitCategoryCode, name: c.unitCategoryName,
        description: c.description ?? '', isActive: c.isActive,
      };
    } else if (kind === 'unit') {
      const u = row as UnitDto;
      this.form = {
        ...this._emptyForm(),
        code: u.unitCode, name: u.unitName, symbol: u.symbol ?? '',
        decimalPlaces: u.decimalPlaces ?? null,
        isBaseUnit: u.isBaseUnit, isActive: u.isActive,
      };
    } else {
      const c = row as UnitConversionDto;
      this.form = {
        ...this._emptyForm(),
        toUnitId: c.toUnitId ?? null,
        multiplyValue: c.multiplyValue ?? null,
        divideValue: c.divideValue ?? null,
        formulaType: c.formulaType,
        isActive: c.isActive,
      };
    }

    this.onRatioChange();
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
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t(LABEL_KEYS[kind]),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t(LABEL_KEYS[kind]) }));
      },
    });
  }

  askDelete(kind: EntityKind): void {
    const row = {
      category: this.selectedCategory(), unit: this.selectedUnit(), conversion: this.selectedConversion(),
    }[kind];
    if (!row) return;

    const label = kind === 'category' ? (row as UnitCategoryDto).unitCategoryName
      : kind === 'unit' ? (row as UnitDto).unitName
      : `${this.unitLabel(this.selectedUnit()?.id)} → ${this.unitLabel((row as UnitConversionDto).toUnitId)}`;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t(LABEL_KEYS[kind]) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still referenced" rules and returns its own message.
      accept: () => this._apiFor(kind).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t(LABEL_KEYS[kind]) }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _apiFor(kind: EntityKind) {
    return { category: this.categoryApi, unit: this.unitApi, conversion: this.conversionApi }[kind];
  }

  private _emptyForm(): EntityForm {
    return {
      code: '', name: '', description: '', symbol: '', decimalPlaces: null,
      isBaseUnit: false, isActive: true,
      toUnitId: null, multiplyValue: 1, divideValue: 1, formulaType: 1,
    };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(kind: EntityKind): string {
    if (kind === 'category' || kind === 'unit') {
      const code = this.form.code.trim();
      if (!code) return this.i18n.t('plant.err.codeRequired');
      if (!this.form.name.trim()) return this.i18n.t('plant.err.nameRequired');

      if (kind === 'unit' && !this.selectedCategory()) return this.i18n.t('unit.err.pickCategory');

      // Codes are plant-wide identifiers, so duplicates are checked across every row
      // rather than only inside the category on screen.
      const clash = kind === 'category'
        ? this.categoryApi.items().find(c =>
            c.unitCategoryCode.toLowerCase() === code.toLowerCase() && c.id !== this.editingId())
        : this.unitApi.items().find(u =>
            u.unitCode.toLowerCase() === code.toLowerCase() && u.id !== this.editingId());
      return clash ? this.i18n.t('plant.err.codeTaken', { code }) : '';
    }

    const from = this.selectedUnit();
    if (!from) return this.i18n.t('unit.err.pickUnit');
    if (this.form.toUnitId == null) return this.i18n.t('unit.err.toRequired');
    if (this.form.toUnitId === from.id) return this.i18n.t('unit.err.sameUnit');
    if (!this.form.divideValue) return this.i18n.t('unit.err.zeroDivide');

    // Converting across categories is almost always a mistake — kilograms do not become
    // metres — so it is refused rather than merely flagged.
    const target = this.unitApi.items().find(u => u.id === this.form.toUnitId);
    if (target && target.unitCategoryId !== from.unitCategoryId) {
      return this.i18n.t('unit.err.crossCategory', { name: target.unitName });
    }
    return '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    if (kind === 'category') {
      const body = {
        unitCategoryCode: this.form.code.trim(),
        unitCategoryName: this.form.name.trim(),
        description: this.form.description.trim() || null,
        isActive: this.form.isActive,
      };
      return id ? this.categoryApi.update(id, body) : this.categoryApi.create(body);
    }

    if (kind === 'unit') {
      const categoryId = this.selectedCategory()?.id;
      if (categoryId == null) return null;
      const body = {
        unitCategoryId: categoryId,
        unitCode: this.form.code.trim(),
        unitName: this.form.name.trim(),
        symbol: this.form.symbol.trim() || null,
        decimalPlaces: this.form.decimalPlaces,
        isBaseUnit: this.form.isBaseUnit,
        isActive: this.form.isActive,
      };
      return id ? this.unitApi.update(id, body) : this.unitApi.create(body);
    }

    const fromUnitId = this.selectedUnit()?.id;
    if (fromUnitId == null) return null;
    const body = {
      fromUnitId,
      toUnitId: this.form.toUnitId,
      multiplyValue: this.form.multiplyValue,
      divideValue: this.form.divideValue,
      formulaType: this.form.formulaType,
      isActive: this.form.isActive,
    };
    return id ? this.conversionApi.update(id, body) : this.conversionApi.create(body);
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
