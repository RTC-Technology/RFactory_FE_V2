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
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import {
  BomApiService, ProductApiService, ProductTypeApiService, RoutingApiService,
  RoutingOperationApiService, UnitApiService,
} from '../../core/services/product-api.service';
import {
  BomDto, ProductDto, PRODUCT_STATUSES, RoutingDto, RoutingOperationDto, productStatusOf,
} from '../../domain/models/product.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';


type EntityKind = 'product' | 'bom' | 'routing' | 'routingOp';

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
  sequence: number | null;
  description: string;
  isFinishOperation: boolean;
  isOutputOperation: boolean;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  product: 'product.lower',
  bom: 'bom.lower',
  routing: 'routing.lower',
  routingOp: 'routing.op.lower',
};

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule, ToggleSwitchModule, CheckboxModule, TabsModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent extends PermissionAwarePage implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly typeApi = inject(ProductTypeApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly bomApi = inject(BomApiService);
  private readonly routingApi = inject(RoutingApiService);
  private readonly routingOpApi = inject(RoutingOperationApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusOf = productStatusOf;

  readonly loading = computed(() =>
    this.productApi.loading() || this.bomApi.loading()
    || this.routingApi.loading() || this.routingOpApi.loading());

  // ─── Lookups ────────────────────────────────────────────────────────────────

  typeName(id?: number | null): string {
    return this.typeApi.items().find(t => t.id === id)?.productTypeName ?? '';
  }

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? (unit.symbol || unit.unitCode) : '';
  }

  routingLabel(id?: number | null): string {
    const routing = this.routingApi.items().find(r => r.id === id);
    return routing ? `#${routing.id} · ${routing.version || '—'}` : '';
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

  // ─── Selection ──────────────────────────────────────────────────────────────

  /** The product the detail modal is showing; every tab scopes off it. */
  readonly selectedProduct = signal<ProductDto | null>(null);
  readonly selectedBom = signal<BomDto | null>(null);
  readonly selectedRouting = signal<RoutingDto | null>(null);
  readonly selectedRoutingOp = signal<RoutingOperationDto | null>(null);

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

  readonly routings = computed(() => {
    const productId = this.selectedProduct()?.id;
    if (productId == null) return [];
    return this.routingApi.items().filter(r => r.productId === productId);
  });

  readonly routingOps = computed(() => {
    const routingId = this.selectedRouting()?.id;
    if (routingId == null) return [];
    return this.routingOpApi.items().filter(o => o.routingId === routingId);
  });

  /** BOMs the backend holds with no product. No panel here can reach them. */
  readonly unassignedBoms = computed(() =>
    this.bomApi.items().filter(b => b.productId == null).length);

  constructor() {
    // The combinations below each drive one list inside the detail modal, so the selected
    // row has to stay valid when the underlying set changes (filter, reload, delete).
    super();
    effect(() => {
      const boms = this.boms();
      untracked(() => this.selectedBom.set(this._reconcile(this.selectedBom(), boms)));
    });
    effect(() => {
      const routings = this.routings();
      untracked(() => this.selectedRouting.set(this._reconcile(this.selectedRouting(), routings)));
    });
    effect(() => {
      const ops = this.routingOps();
      untracked(() => this.selectedRoutingOp.set(this._reconcile(this.selectedRoutingOp(), ops)));
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
      routings: this.routingApi.load(),
      routingOps: this.routingOpApi.load(),
    }).subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('product.err.load'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly productTable = viewChild<Table>('productTable');
  private readonly bomTable = viewChild<Table>('bomTable');
  private readonly routingTable = viewChild<Table>('routingTable');
  private readonly routingOpTable = viewChild<Table>('routingOpTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    product: ['productCode', 'productName', 'drawingNo'],
    bom: ['bomCode', 'bomName', 'version'],
    routing: ['version'],
    routingOp: ['routingOperationCode', 'routingOperationName', 'description'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = {
      product: this.productTable(), bom: this.bomTable(),
      routing: this.routingTable(), routingOp: this.routingOpTable(),
    }[kind];
    table?.filterGlobal(value, 'contains');
  }

  selectProduct(product: ProductDto): void {
    if (this.selectedProduct()?.id === product.id) return;
    this.selectedProduct.set(product);
  }

  selectBom(bom: BomDto): void {
    this.selectedBom.set(bom);
  }

  selectRouting(routing: RoutingDto): void {
    this.selectedRouting.set(routing);
    this.selectedRoutingOp.set(this._first(this.routingOps()));
  }

  selectRoutingOp(op: RoutingOperationDto): void {
    this.selectedRoutingOp.set(op);
  }

  // ─── Detail modal ───────────────────────────────────────────────────────────

  readonly detailOpen = signal(false);
  readonly detailTab = signal<string>('info');

  readonly detailTitle = computed(() => {
    const product = this.selectedProduct();
    return product
      ? this.i18n.t('product.detailOf', { name: `${product.productCode} · ${product.productName}` })
      : '';
  });

  openDetail(product: ProductDto): void {
    this.selectedProduct.set(product);
    this.selectedBom.set(this._first(this.boms()));
    this.selectedRouting.set(this._first(this.routings()));
    this.selectedRoutingOp.set(this._first(this.routingOps()));
    this.detailTab.set('info');
    this.detailOpen.set(true);
  }

  // ─── CRUD dialog ───────────────────────────────────────────────────────────

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
    const row = {
      product: this.selectedProduct(), bom: this.selectedBom(),
      routing: this.selectedRouting(), routingOp: this.selectedRoutingOp(),
    }[kind];
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
    } else if (kind === 'routing') {
      const r = row as RoutingDto;
      this.form = {
        ...this._emptyForm(),
        version: r.version ?? '', isActive: r.isActive,
      };
    } else {
      const o = row as RoutingOperationDto;
      this.form = {
        ...this._emptyForm(),
        sequence: o.sequence ?? null, code: o.routingOperationCode, name: o.routingOperationName,
        description: o.description ?? '',
        isFinishOperation: o.isFinishOperation, isOutputOperation: o.isOutputOperation,
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
      product: this.selectedProduct(), bom: this.selectedBom(),
      routing: this.selectedRouting(), routingOp: this.selectedRoutingOp(),
    }[kind];
    if (!row) return;

    const label = kind === 'product' ? (row as ProductDto).productName
      : kind === 'bom' ? (row as BomDto).bomName
      : kind === 'routing' ? `#${(row as RoutingDto).id}`
        : (row as RoutingOperationDto).routingOperationName;

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
    return { product: this.productApi, bom: this.bomApi, routing: this.routingApi, routingOp: this.routingOpApi }[kind];
  }

  private _emptyForm(): EntityForm {
    return {
      code: '', name: '', typeId: null, unitId: null,
      drawingNo: '', drawingPath: '', status: 1,
      version: '', isActive: true,
      sequence: null, description: '', isFinishOperation: false, isOutputOperation: false,
    };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _first<T extends { id: number }>(rows: T[]): T | null {
    return rows[0] ?? null;
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

    if (kind === 'routing') {
      if (!this.selectedProduct()) return this.i18n.t('bom.err.pickProduct');
      if (!this.form.version.trim()) return this.i18n.t('plant.err.nameRequired');
      return '';
    }

    if (!this.selectedRouting()) return this.i18n.t('routing.err.pickRouting');
    if (!this.form.code.trim()) return this.i18n.t('routing.err.opCodeRequired');
    if (!this.form.name.trim()) return this.i18n.t('routing.err.opNameRequired');

    const duplicate = this.routingOps().find(
      o => o.routingOperationCode.toLowerCase() === this.form.code.trim().toLowerCase()
        && o.id !== this.editingId(),
    );
    return duplicate
      ? this.i18n.t('routing.err.duplicate', { name: duplicate.routingOperationName })
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

    if (kind === 'routing') {
      const productId = this.selectedProduct()?.id;
      if (productId == null) return null;
      const body = {
        productId,
        version: this.form.version.trim() || null,
        isActive: this.form.isActive,
      };
      return id ? this.routingApi.update(id, body) : this.routingApi.create(body);
    }

    const routingId = this.selectedRouting()?.id;
    if (routingId == null) return null;
    const body = {
      routingId,
      sequence: this.form.sequence,
      routingOperationCode: this.form.code.trim(),
      routingOperationName: this.form.name.trim(),
      description: this.form.description.trim() || null,
      isFinishOperation: this.form.isFinishOperation,
      isOutputOperation: this.form.isOutputOperation,
    };
    return id ? this.routingOpApi.update(id, body) : this.routingOpApi.create(body);
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
