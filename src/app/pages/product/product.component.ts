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
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import {
  BomApiService, BomDetailApiService, ProductApiService, ProductTypeApiService, UnitApiService,
} from '../../core/services/product-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import {
  BomDetailDto, BomDto, PRODUCT_STATUSES, ProductDto, productStatusOf, requiredQuantity,
} from '../../domain/models/product.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
// import { InputTextModule } from 'primeng/inputtext';


type EntityKind = 'product' | 'bom' | 'line';

interface EntityForm {
  code: string;
  name: string;
  typeId: number | null;
  unitId: number | null;
  drawingNo: string;
  drawingPath: string;
  status: number | null;
  version: string;
  isActive: boolean;
  componentId: number | null;
  quantity: number | null;
  scrapRate: number | null;
  fixedScrapQty: number | null;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  product: 'product.lower',
  bom: 'bom.lower',
  line: 'bom.line.lower',
};

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly typeApi = inject(ProductTypeApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly bomApi = inject(BomApiService);
  private readonly lineApi = inject(BomDetailApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  readonly perms = PERMISSIONS;
  readonly statusOf = productStatusOf;
  readonly requiredQty = requiredQuantity;

  readonly loading = computed(() => this.productApi.loading() || this.bomApi.loading());

  // ─── Lookups ────────────────────────────────────────────────────────────────

  typeName(id?: number | null): string {
    return this.typeApi.items().find(t => t.id === id)?.productTypeName ?? '';
  }

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? (unit.symbol || unit.unitCode) : '';
  }

  productLabel(id?: number | null): string {
    const product = this.productApi.items().find(p => p.id === id);
    return product ? `${product.productCode} · ${product.productName}` : '';
  }

  /** Only active types can be picked; inactive ones stay visible on rows that already use them. */
  readonly typeOptions = computed(() => [
    { label: this.i18n.t('product.noType'), value: null },
    ...this.typeApi.items()
      .filter(t => t.isActive)
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
      .map(t => ({ label: `${t.productTypeCode} · ${t.productTypeName}`, value: t.id })),
  ]);

  readonly unitOptions = computed(() => [
    { label: this.i18n.t('product.status.unset'), value: null },
    ...this.unitApi.items()
      .filter(u => u.isActive)
      .map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })),
  ]);

  readonly statusOptions = computed(() =>
    PRODUCT_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

  /** Every product except the one the BOM builds — see `_validate` for why. */
  readonly componentOptions = computed(() => {
    const ownerId = this.selectedProduct()?.id;
    return this.productApi.items()
      .filter(p => p.id !== ownerId)
      .map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id }));
  });

  // ─── Selection ──────────────────────────────────────────────────────────────

  readonly selectedProduct = signal<ProductDto | null>(null);
  readonly selectedBom = signal<BomDto | null>(null);
  readonly selectedLine = signal<BomDetailDto | null>(null);

  /** Type filter above the product list — the first thing an operator reaches for. */
  readonly typeFilter = signal<number | null>(null);

  readonly typeFilterOptions = computed(() => [
    { label: this.i18n.t('product.allTypes'), value: null },
    ...this.typeApi.items()
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
      .map(t => ({ label: `${t.productTypeCode} · ${t.productTypeName}`, value: t.id })),
  ]);

  readonly products = computed(() => {
    const typeId = this.typeFilter();
    const all = this.productApi.items();
    return typeId === null ? all : all.filter(p => p.productTypeId === typeId);
  });

  readonly boms = computed(() => {
    const productId = this.selectedProduct()?.id;
    if (productId == null) return [];
    return this.bomApi.items().filter(b => b.productId === productId);
  });

  readonly lines = computed(() => {
    const bomId = this.selectedBom()?.id;
    if (bomId == null) return [];
    return this.lineApi.items().filter(l => l.bomId === bomId);
  });

  /** BOMs the backend holds with no product. No panel here can reach them. */
  readonly unassignedBoms = computed(() =>
    this.bomApi.items().filter(b => b.productId == null).length);

  constructor() {
    effect(() => {
      const boms = this.boms();
      untracked(() => this.selectedBom.set(this._reconcile(this.selectedBom(), boms)));
    });
    effect(() => {
      const lines = this.lines();
      untracked(() => this.selectedLine.set(this._reconcile(this.selectedLine(), lines)));
    });
    // Narrowing the type filter can hide the selected product, which would leave the BOM
    // panels driven from off-screen.
    effect(() => {
      const products = this.products();
      untracked(() => this.selectedProduct.set(this._reconcile(this.selectedProduct(), products)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      products: this.productApi.load(),
      types: this.typeApi.load(),
      units: this.unitApi.load(),
      boms: this.bomApi.load(),
      lines: this.lineApi.load(),
    }).subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('product.err.load'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly productTable = viewChild<Table>('productTable');
  private readonly bomTable = viewChild<Table>('bomTable');
  private readonly lineTable = viewChild<Table>('lineTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    product: ['productCode', 'productName', 'drawingNo'],
    bom: ['bomCode', 'bomName', 'version'],
    line: [],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = { product: this.productTable(), bom: this.bomTable(), line: this.lineTable() }[kind];
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'product') {
      this.selectedProduct.set(this._reconcile(this.selectedProduct(), visible as ProductDto[]));
    } else if (kind === 'bom') {
      this.selectedBom.set(this._reconcile(this.selectedBom(), visible as BomDto[]));
    } else {
      this.selectedLine.set(this._reconcile(this.selectedLine(), visible as BomDetailDto[]));
    }
  }

  selectProduct(product: ProductDto): void {
    if (this.selectedProduct()?.id === product.id) return;
    this.selectedProduct.set(product);
  }

  selectBom(bom: BomDto): void {
    this.selectedBom.set(bom);
  }

  selectLine(line: BomDetailDto): void {
    this.selectedLine.set(line);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('product');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = this._emptyForm();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t(LABEL_KEYS[this.dialogKind()]),
    }));

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = {
      ...this._emptyForm(),
      // A new product lands in whatever type the list is filtered to — that is nearly
      // always the one being worked on.
      typeId: kind === 'product' ? this.typeFilter() : null,
    };
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = { product: this.selectedProduct(), bom: this.selectedBom(), line: this.selectedLine() }[kind];
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');

    if (kind === 'product') {
      const p = row as ProductDto;
      this.form = {
        ...this._emptyForm(),
        code: p.productCode, name: p.productName,
        typeId: p.productTypeId ?? null, unitId: p.defaultUnitId ?? null,
        drawingNo: p.drawingNo ?? '', drawingPath: p.drawingPath ?? '',
        status: p.status ?? null,
      };
    } else if (kind === 'bom') {
      const b = row as BomDto;
      this.form = {
        ...this._emptyForm(),
        code: b.bomCode, name: b.bomName,
        version: b.version ?? '', status: b.status ?? null, isActive: b.isActive,
      };
    } else {
      const l = row as BomDetailDto;
      this.form = {
        ...this._emptyForm(),
        componentId: l.productId ?? null, unitId: l.unitId ?? null,
        quantity: l.quantity ?? null, scrapRate: l.scrapRate ?? null,
        fixedScrapQty: l.fixedScrapQty ?? null,
      };
    }

    this.dialogOpen.set(true);
  }

  /** Picking a component seeds the unit from that product, which is right nearly always. */
  onComponentChange(): void {
    if (this.form.unitId != null) return;
    const component = this.productApi.items().find(p => p.id === this.form.componentId);
    this.form.unitId = component?.defaultUnitId ?? null;
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
    const row = { product: this.selectedProduct(), bom: this.selectedBom(), line: this.selectedLine() }[kind];
    if (!row) return;

    const label = kind === 'product' ? (row as ProductDto).productName
      : kind === 'bom' ? (row as BomDto).bomName
        : this.productLabel((row as BomDetailDto).productId);

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
    return { product: this.productApi, bom: this.bomApi, line: this.lineApi }[kind];
  }

  private _emptyForm(): EntityForm {
    return {
      code: '', name: '', typeId: null, unitId: null,
      drawingNo: '', drawingPath: '', status: 1,
      version: '', isActive: true,
      componentId: null, quantity: null, scrapRate: null, fixedScrapQty: null,
    };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(kind: EntityKind): string {
    if (kind === 'product') {
      const code = this.form.code.trim();
      if (!code) return this.i18n.t('plant.err.codeRequired');
      if (!this.form.name.trim()) return this.i18n.t('plant.err.nameRequired');

      // Compared against every product, not just the filtered view — the code is a
      // plant-wide identifier and a duplicate hidden by the filter is still a duplicate.
      const clash = this.productApi.items().find(
        p => p.productCode.toLowerCase() === code.toLowerCase() && p.id !== this.editingId(),
      );
      return clash ? this.i18n.t('plant.err.codeTaken', { code }) : '';
    }

    if (kind === 'bom') {
      if (!this.selectedProduct()) return this.i18n.t('bom.err.pickProduct');
      const code = this.form.code.trim();
      if (!code) return this.i18n.t('plant.err.codeRequired');
      if (!this.form.name.trim()) return this.i18n.t('plant.err.nameRequired');

      const clash = this.bomApi.items().find(
        b => b.bomCode.toLowerCase() === code.toLowerCase() && b.id !== this.editingId(),
      );
      return clash ? this.i18n.t('plant.err.codeTaken', { code }) : '';
    }

    if (!this.selectedBom()) return this.i18n.t('bom.err.pickBom');
    if (this.form.componentId == null) return this.i18n.t('bom.err.componentRequired');
    if (this.form.quantity == null || this.form.quantity <= 0) return this.i18n.t('bom.err.quantityRequired');

    // A product that is a component of its own BOM would explode any recursive material
    // calculation. The picker already excludes it; this catches a stale form.
    if (this.form.componentId === this.selectedProduct()?.id) return this.i18n.t('bom.err.selfReference');

    const duplicate = this.lines().find(
      l => l.productId === this.form.componentId && l.id !== this.editingId(),
    );
    return duplicate
      ? this.i18n.t('bom.err.duplicate', { name: this.productLabel(duplicate.productId) })
      : '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    if (kind === 'product') {
      const body = {
        productCode: this.form.code.trim(),
        productName: this.form.name.trim(),
        productTypeId: this.form.typeId,
        defaultUnitId: this.form.unitId,
        drawingNo: this.form.drawingNo.trim() || null,
        drawingPath: this.form.drawingPath.trim() || null,
        status: this.form.status,
      };
      return id ? this.productApi.update(id, body) : this.productApi.create(body);
    }

    if (kind === 'bom') {
      const productId = this.selectedProduct()?.id;
      if (productId == null) return null;
      const body = {
        productId,
        bomCode: this.form.code.trim(),
        bomName: this.form.name.trim(),
        version: this.form.version.trim() || null,
        status: this.form.status,
        isActive: this.form.isActive,
      };
      return id ? this.bomApi.update(id, body) : this.bomApi.create(body);
    }

    const bomId = this.selectedBom()?.id;
    if (bomId == null) return null;
    const body = {
      bomId,
      productId: this.form.componentId,
      quantity: this.form.quantity,
      unitId: this.form.unitId,
      scrapRate: this.form.scrapRate,
      fixedScrapQty: this.form.fixedScrapQty,
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
      life: 4500,
    });
  }


  visible: boolean = false;
  username: string = '';
  email: string = '';
  showDialog() {
    this.visible = true;
  }
}
