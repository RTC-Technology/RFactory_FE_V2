import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { I18nService } from '../../core/services/i18n.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { GoodsReceiptApiService, GoodsReceiptDetailApiService } from '../../core/services/goods-receipt-api.service';
import { GOODS_RECEIPT_TYPES, GoodsReceiptDetailDto, GoodsReceiptDto } from '../../domain/models/goods-receipt.model';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { forkJoin, Observable } from 'rxjs';
import { SplitterModule } from 'primeng/splitter';
import { SelectModule } from 'primeng/select';
import { SplitStateService } from '../../core/services/split-state.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { PanelModule } from 'primeng/panel';
import { CardModule } from 'primeng/card';

type EntityKind = 'goodsReceipt' | 'goodsReceiptDetail';
const LABEL_KEYS: Record<EntityKind, string> = {
  goodsReceipt: 'goodsReceipt.lower',
  goodsReceiptDetail: 'goodsReceiptDetail.lower',
};


@Component({
  selector: 'app-goods-receipt',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, SelectModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective, PanelModule, CardModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './goods-receipt.component.html',
  styleUrl: './goods-receipt.component.scss',
})
export class GoodsReceiptComponent implements OnInit {

  private readonly productApi = inject(ProductApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly goodsReceiptApi = inject(GoodsReceiptApiService);
  private readonly goodsReceiptDetailApi = inject(GoodsReceiptDetailApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  readonly perms = PERMISSIONS;
  // readonly statusOf = productStatusOf;
  // readonly requiredQty = requiredQuantity;

  readonly loading = computed(() => this.goodsReceiptApi.loading() || this.goodsReceiptDetailApi.loading());
  private _tempDetailId = 0;

  /** Ordered the way the product screen's type picker will show them. */
  readonly types = computed(() =>
    [...this.goodsReceiptApi.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.receiptNo.localeCompare(b.receiptNo)));


  // ─── Lookups ────────────────────────────────────────────────────────────────

  // typeName(id?: number | null): string {
  //   return this.typeApi.items().find(t => t.id === id)?.productTypeName ?? '';
  // }

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? (unit.symbol || unit.unitCode) : '';
  }

  productLabel(id?: number | null): string {
    const product = this.productApi.items().find(p => p.id === id);
    return product ? `${product.productCode} · ${product.productName}` : '';
  }

  /** Only active types can be picked; inactive ones stay visible on rows that already use them. */
  // readonly typeOptions = computed(() => [
  //   { label: this.i18n.t('product.noType'), value: null },
  //   ...this.typeApi.items()
  //     .filter(t => t.isActive)
  //     .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
  //     .map(t => ({ label: `${t.productTypeCode} · ${t.productTypeName}`, value: t.id })),
  // ]);

  readonly unitOptions = computed(() => [
    { label: this.i18n.t('product.status.unset'), value: null },
    ...this.unitApi.items()
      .filter(u => u.isActive)
      .map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })),
  ]);

  readonly productOptions = computed(() => [
    { label: 'Chọn sản phẩm', value: null },
    ...this.productApi.items().map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id })),
  ]);

  readonly typeOptions = computed(() =>
    GOODS_RECEIPT_TYPES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

  /** Every product except the one the BOM builds — see `_validate` for why. */
  // readonly componentOptions = computed(() => {
  //   const ownerId = this.selectedProduct()?.id;
  //   return this.productApi.items()
  //     .filter(p => p.id !== ownerId)
  //     .map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id }));
  // });

  // ─── Selection ──────────────────────────────────────────────────────────────

  readonly selectedReceipt = signal<GoodsReceiptDto | null>(null);
  readonly selectedDetail = signal<GoodsReceiptDetailDto | null>(null);

  /** Type filter above the product list — the first thing an operator reaches for. */
  readonly typeFilter = signal<string | null>(null);


  readonly receipt = computed(() => {
    const typeId = this.typeFilter();
    const all = this.goodsReceiptApi.items();
    return typeId === null ? all : all.filter(p => p.receiptNo === typeId);
  });

  readonly receiptDetail = computed(() => {
    const receiptId = this.selectedReceipt()?.id;
    if (receiptId == null) return [];
    return this.goodsReceiptDetailApi.items().filter(b => b.goodsReceiptId === receiptId);
  });

  readonly dialogReceiptDetail = computed(() => {
    const existing = this.editingId() == null
      ? []
      : (() => {
        const receiptId = this.selectedReceipt()?.id;
        return receiptId == null ? [] : this.goodsReceiptDetailApi.items().filter(b => b.goodsReceiptId === receiptId);
      })();

    return [...existing, ...this.dialogDraftDetails()];
  });


  /** BOMs the backend holds with no product. No panel here can reach them. */
  readonly unassignedReceipts = computed(() =>
    this.goodsReceiptApi.items().filter(b => b.id == null).length);

  constructor() {
    effect(() => {
      const receipt = this.receipt();
      untracked(() => this.selectedReceipt.set(this._reconcile(this.selectedReceipt(), receipt)));
    });

    effect(() => {
      const details = this.receiptDetail();
      untracked(() => this.selectedDetail.set(this._reconcile(this.selectedDetail(), details)));
    });
    // Narrowing the type filter can hide the selected product, which would leave the BOM
    // panels driven from off-screen.

  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      receipt: this.goodsReceiptApi.load(),
      details: this.goodsReceiptDetailApi.load(),
    }).subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('product.err.load'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly receiptTable = viewChild<Table>('receiptTable');
  private readonly detailTable = viewChild<Table>('detailtTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    goodsReceipt: ['receiptNo'],
    goodsReceiptDetail: [],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = { goodsReceipt: this.receiptTable(), goodsReceiptDetail: this.detailTable() }[kind];
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'goodsReceipt') {
      this.selectedReceipt.set(this._reconcile(this.selectedReceipt(), visible as GoodsReceiptDto[]));
    } else if (kind === 'goodsReceiptDetail') {
      this.selectedDetail.set(this._reconcile(this.selectedDetail(), visible as GoodsReceiptDetailDto[]));
    }
  }

  selectReceipt(receipt: GoodsReceiptDto): void {
    if (this.selectedReceipt()?.id === receipt.id) return;
    this.selectedReceipt.set(receipt);
  }

  selectDetail(detail: GoodsReceiptDetailDto): void {
    this.selectedDetail.set(detail);
  }


  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly dialogDraftDetails = signal<GoodsReceiptDetailDto[]>([]);
  form = this._emptyForm();
  detailForm = this._emptyDetailForm();

  penCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), receiptNo: this._nextReceiptNo() };
    this.dialogOpen.set(true);
  }

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t('ptype.lower'),
    }));

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.dialogDraftDetails.set([]);
    this.detailForm = this._emptyDetailForm();
    this.form = { ...this._emptyForm(), receiptNo: this._nextReceiptNo() };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selectedReceipt();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      receiptNo: row.receiptNo ?? '',
      warehouseId: row.warehouseId ?? 0,
      supplierId: row.supplierId ?? 0,
      referenceType: row.referenceType?.trim() ?? '',
      referenceId: row.referenceId ?? 0,
      receiptDate: row.receiptDate,
      remark: row.remark?.trim() || '',
      receiptType: row.receiptType ?? 0,
    };
    this.dialogDraftDetails.set([]);
    this.detailForm = this._emptyDetailForm();
    this.dialogOpen.set(true);
  }

  // save(): void {
  //   const code = this.form.receiptNo.trim();
  //   // const name = this.form.name.trim();
  //   if (!code) { this.formError.set(this.i18n.t('plant.err.codeRequired')); return; }
  //   // if (!name) { this.formError.set(this.i18n.t('plant.err.nameRequired')); return; }

  //   const clash = this.types().find(
  //     t => t.receiptNo.toLowerCase() === code.toLowerCase() && t.id !== this.editingId(),
  //   );
  //   if (clash) { this.formError.set(this.i18n.t('plant.err.codeTaken', { code })); return; }

  //   this.saving.set(true);
  //   this.formError.set('');

  //   const id = this.editingId();

  //   const body = {
  //     receiptNo: this.form.receiptNo,
  //     warehouseId: this.form.warehouseId,
  //     supplierId: this.form.supplierId,
  //     referenceType: this.form.referenceType?.trim() || null,
  //     referenceId: this.form.referenceId,
  //     receiptDate: this.form.receiptDate,
  //     remark: this.form.remark?.trim() || null,
  //     receiptType: 1,
  //   };
  //   const request: Observable<unknown> = id ? this.goodsReceiptApi.update(id, body) : this.goodsReceiptApi.create(body);

  //   request.subscribe({
  //     next: () => {
  //       this.saving.set(false);
  //       this.dialogOpen.set(false);
  //       this.reload();
  //       this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
  //         entity: this.i18n.t('ptype.lower'),
  //       }));
  //     },
  //     error: (err: HttpErrorResponse) => {
  //       this.saving.set(false);
  //       this.formError.set(err.error?.message
  //         || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('ptype.lower') }));
  //     },
  //   });
  // }

  save(): void {
    // const kind = this.dialogKind();
    const error = this._validate();
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const request = this._buildRequest(id);
    if (!request) {
      this.saving.set(false);
      return;
    }

    // console.log('dialogReceiptDetail:', this.dialogReceiptDetail());

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t('goodsReceipt.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('goodsReceipt.lower') }));
      },
    });
  }


  askDelete(): void {
    const row = this.selectedReceipt();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('goodsReceipt.lower') }),
      message: `${this.i18n.t('plant.confirm.message', { label: row.receiptNo })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still used by products" rule and returns its own message.
      accept: () => this.goodsReceiptApi.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.receiptNo })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('goodsReceipt.lower') }), err),
      }),
    });
  }


  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm() {
    return {
      receiptNo: '',
      warehouseId: 0,
      supplierId: 0,
      referenceType: '',
      referenceId: 0,
      receiptDate: formatDate(new Date(), 'yyyy-MM-dd HH:mm', 'en-US'),
      remark: '',
      receiptType: 1
    };

  }

  private _emptyDetailForm() {
    return {
      id: this._tempDetailId--,
      goodsReceiptId: this.selectedReceipt()?.id ?? 0,
      productId: 0,
      unitId: 0,
      locationId: null,
      lotNo: '',
      serialNo: '',
      quantity: 1,
      receivedQty: 1,
      unitPrice: 0,
      remark: '',
    };
  }


  private _nextReceiptNo(): string {
    const prefix = 'GD';

    // const now = new Date();
    const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
    const prefixWithDate = `${prefix}_${datePart}_`;

    const existing = this.receipt().filter(r =>
      r.receiptNo.startsWith(prefixWithDate),
    );

    // console.log('existing:', existing);
    let stt = 1;

    if (existing.length > 0) {
      const numbers = existing
        .map(r => {
          const match = r.receiptNo.match(
            new RegExp(`^${prefix}_${datePart}_(\\d+)$`),
          );

          return match ? Number(match[1]) : 0;
        })
        .filter(n => n > 0);

      // console.log('numbers:', numbers);

      if (numbers.length > 0) {
        stt = Math.max(...numbers) + 1;
      }
    }

    return `${prefixWithDate}${String(stt).padStart(3, '0')}`;
  }


  private _validate(): string {
    const receiptNo = this.form.receiptNo.trim();

    if (!receiptNo) {
      return this.i18n.t('goodsReceipt.err.receiptNoRequired');
    }

    // if (!this.form.warehouseId) {
    //   return this.i18n.t('goodsReceipt.err.warehouseIdRequired');
    // }

    if (!this.form.receiptDate) {
      return this.i18n.t('goodsReceipt.err.receiptDateRequired');
    }

    if (!this.form.receiptType) {
      return this.i18n.t('goodsReceipt.err.receiptTypeRequired');
    }

    // ReceiptNo is unique across the entire goods receipt list.
    const clash = this.goodsReceiptApi.items().find(
      receipt =>
        receipt.receiptNo.toLowerCase() === receiptNo.toLowerCase() &&
        receipt.id !== this.editingId(),
    );

    return clash
      ? this.i18n.t('goodsReceipt.err.receiptNoTaken', { receiptNo })
      : '';
  }

  private _buildRequest(id: number | null): Observable<unknown> | null {
    const body = {
      receiptNo: this.form.receiptNo,
      warehouseId: this.form.warehouseId,
      supplierId: this.form.supplierId,
      referenceType: this.form.referenceType?.trim() || null,
      referenceId: this.form.referenceId,
      receiptDate: this.form.receiptDate,
      remark: this.form.remark?.trim() || null,
      receiptType: this.form.receiptType ?? 1,
    };
    return id ? this.goodsReceiptApi.update(id, body) : this.goodsReceiptApi.create(body);
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

  addDetail(): void {
    this.dialogDraftDetails.update(details => [
      ...details,
      this._emptyDetailForm(),
    ]);
  }
}
