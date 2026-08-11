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
import {
  GOODS_RECEIPT_TYPES, GoodsReceiptDetailDto, GoodsReceiptDto, GoodsReceiptRequest,
} from '../../domain/models/goods-receipt.model';
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

/** `<input type="datetime-local">` accepts nothing else — a space instead of the `T` and
 *  the browser silently blanks the field, which used to leave the date box empty. */
const DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm";


@Component({
  selector: 'app-goods-receipt',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, SelectModule, TagModule, ToggleSwitchModule,
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

  readonly loading = computed(() => this.goodsReceiptApi.loading() || this.goodsReceiptDetailApi.loading());

  /** Ordered the way the product screen's type picker will show them. */
  readonly types = computed(() =>
    [...this.goodsReceiptApi.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.receiptNo.localeCompare(b.receiptNo)));


  // ─── Lookups ────────────────────────────────────────────────────────────────

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? (unit.symbol || unit.unitCode) : '';
  }

  productLabel(id?: number | null): string {
    const product = this.productApi.items().find(p => p.id === id);
    return product ? `${product.productCode} · ${product.productName}` : '';
  }

  readonly unitOptions = computed(() =>
    this.unitApi.items()
      .filter(u => u.isActive)
      .map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

  /** Feeds the per-row picker in the detail grid — `filterBy` searches both code and name,
   *  so the label carries the two fields an operator types. */
  readonly productOptions = computed(() =>
    this.productApi.items()
      .map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id })));

  readonly typeOptions = computed(() =>
    GOODS_RECEIPT_TYPES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

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

  /** Receipts the backend holds with no id. No panel here can reach them. */
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
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    // Products and units are not just labels here — the detail grid's row pickers are
    // driven from them, so an empty list would leave every line unfillable.
    forkJoin({
      receipt: this.goodsReceiptApi.load(),
      details: this.goodsReceiptDetailApi.load(),
      products: this.productApi.load(),
      units: this.unitApi.load(),
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
  form = this._emptyForm();

  /**
   * Working copy of the receipt's lines while the dialog is open. Editing happens in the
   * grid itself, so these must be clones — binding straight to `goodsReceiptDetailApi.items()`
   * would rewrite the service's cache before anything reached the server, and cancelling
   * would leave the page showing edits that were never saved.
   *
   * Lines the operator adds get a negative id so the grid can key them apart; `_saveReceipt`
   * sends those as 0, which the backend reads as "new".
   */
  readonly detailRows = signal<GoodsReceiptDetailDto[]>([]);
  private _tempDetailId = 0;

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t('goodsReceipt.lower'),
    }));

  /**
   * Running total of the lines — the number the operator checks against the delivery note.
   * A method rather than a `computed`: the grid edits row objects in place so the array
   * identity never changes, and rebuilding it on every keystroke would re-render the rows
   * and pull focus out of the cell being typed into.
   */
  detailTotal(): number {
    return this.detailRows().reduce((sum, row) => sum + (row.receivedQty ?? 0) * (row.unitPrice ?? 0), 0);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), receiptNo: this._nextReceiptNo() };
    // A receipt with no line is meaningless, so start the operator on one.
    this.detailRows.set([this._emptyDetailRow()]);
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
      supplierId: row.supplierId ?? null,
      referenceType: row.referenceType?.trim() ?? '',
      referenceId: row.referenceId ?? null,
      receiptDate: this._toLocalInput(row.receiptDate),
      remark: row.remark?.trim() || '',
      receiptType: row.receiptType ?? 1,
      // Carried untouched: the backend maps the whole payload onto the entity, so leaving
      // these out of the PUT would blank the approval and posting trail.
      approvedBy: row.approvedBy ?? null,
      approvedDate: row.approvedDate ?? null,
      postedBy: row.postedBy ?? null,
      postedDate: row.postedDate ?? null,
    };
    this.detailRows.set(
      this.goodsReceiptDetailApi.items()
        .filter(d => d.goodsReceiptId === row.id)
        .map(d => ({ ...d })));
    this.dialogOpen.set(true);
  }

  // ─── Detail grid ────────────────────────────────────────────────────────────

  addDetailRow(): void {
    this.detailRows.update(rows => [...rows, this._emptyDetailRow()]);
  }

  removeDetailRow(row: GoodsReceiptDetailDto): void {
    // No bookkeeping for lines the server already stores: the save sends the whole set and
    // the backend deletes whatever is missing from it.
    this.detailRows.update(rows => rows.filter(r => r !== row));
  }

  /** Picking a product pulls in its default unit; the operator can still override it. */
  onDetailProductChange(row: GoodsReceiptDetailDto, productId: number | null): void {
    row.productId = productId ?? 0;
    const product = this.productApi.items().find(p => p.id === productId);
    row.unitId = product?.defaultUnitId ?? row.unitId;
  }

  /** Received quantity tracks the ordered one until someone edits it apart. */
  onDetailQuantityChange(row: GoodsReceiptDetailDto, quantity: number | null): void {
    const next = quantity ?? 0;
    if (row.receivedQty === row.quantity) row.receivedQty = next;
    row.quantity = next;
  }


  save(): void {
    const error = this._validate() || this._validateDetails();
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();

    // One call carrying the header and every line: the backend writes them in a single
    // transaction, so a rejected line cannot leave a receipt behind.
    this._saveReceipt(id).subscribe({
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
      supplierId: null as number | null,
      referenceType: '',
      referenceId: null as number | null,
      receiptDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
      remark: '',
      receiptType: 1,
      approvedBy: null as number | null,
      approvedDate: null as string | null,
      postedBy: null as number | null,
      postedDate: null as string | null,
    };
  }

  private _emptyDetailRow(): GoodsReceiptDetailDto {
    return {
      id: --this._tempDetailId,
      goodsReceiptId: this.editingId() ?? 0,
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

  /** The backend sends an ISO string with seconds and an offset; the input wants neither. */
  private _toLocalInput(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return isNaN(date.getTime()) ? '' : formatDate(date, DATETIME_LOCAL, 'en-US');
  }

  private _nextReceiptNo(): string {
    const prefix = 'GD';

    const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
    const prefixWithDate = `${prefix}_${datePart}_`;

    const existing = this.receipt().filter(r =>
      r.receiptNo.startsWith(prefixWithDate),
    );

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

  /** Reports the first bad line by its position — the operator reads the grid by row, not by id. */
  private _validateDetails(): string {
    const rows = this.detailRows();
    if (rows.length === 0) return this.i18n.t('goodsReceiptDetail.err.linesRequired');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 1;

      if (!row.productId) return this.i18n.t('goodsReceiptDetail.err.productRequired', { line });
      if (!row.unitId) return this.i18n.t('goodsReceiptDetail.err.unitRequired', { line });
      if (!(row.quantity > 0)) return this.i18n.t('goodsReceiptDetail.err.quantityRequired', { line });
      if (row.receivedQty == null || row.receivedQty < 0) {
        return this.i18n.t('goodsReceiptDetail.err.receivedQtyInvalid', { line });
      }
    }

    return '';
  }

  private _saveReceipt(id: number | null): Observable<GoodsReceiptDto> {
    const body: GoodsReceiptRequest = {
      receiptNo: this.form.receiptNo.trim(),
      warehouseId: this.form.warehouseId,
      supplierId: this.form.supplierId,
      referenceType: this.form.referenceType?.trim() || null,
      referenceId: this.form.referenceId,
      receiptDate: this.form.receiptDate,
      remark: this.form.remark?.trim() || null,
      approvedBy: this.form.approvedBy,
      approvedDate: this.form.approvedDate,
      postedBy: this.form.postedBy,
      postedDate: this.form.postedDate,
      receiptType: this.form.receiptType ?? 1,
      // The whole line set every time: the backend replaces what it holds, which is how a
      // line the operator removed from the grid gets deleted.
      goodsReceiptDetails: this.detailRows().map(row => ({
        // Drafts carry a negative id so the grid can key them; the server reads 0 as "new".
        id: row.id > 0 ? row.id : 0,
        productId: row.productId,
        unitId: row.unitId,
        locationId: row.locationId ?? null,
        lotNo: row.lotNo?.trim() || null,
        serialNo: row.serialNo?.trim() || null,
        quantity: row.quantity,
        receivedQty: row.receivedQty,
        unitPrice: row.unitPrice ?? null,
        remark: row.remark?.trim() || null,
      })),
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
}
