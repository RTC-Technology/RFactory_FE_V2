import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { WarehouseApiService, WarehouseLocationApiService } from '../../core/services/warehouse-api.service';
import { SupplierApiService } from '../../core/services/master-data-api.service';
import { GoodsIssueApiService, GoodsIssueDetailApiService } from '../../core/services/goods-issue-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { GOODS_ISSUE_STATUSES, GoodsIssueDetailDto, GoodsIssueDto, GoodsIssueRequest } from '../../domain/models/goods-issue.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'goodsIssue' | 'goodsIssueDetail';

/** `<input type="datetime-local">` accepts nothing else — a space instead of the `T` and
 *  the browser silently blanks the field, which used to leave the date box empty. */
const DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm";

@Component({
  selector: 'app-goods-issue',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, SelectModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective, PanelModule, CardModule, InputNumberModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './goods-issue.component.html',
  styleUrl: './goods-issue.component.scss',
})
export class GoodsIssueComponent extends PermissionAwarePage implements OnInit {

  private readonly productApi = inject(ProductApiService);
  private readonly unitApi = inject(UnitApiService);
  private readonly warehouseApi = inject(WarehouseApiService);
  private readonly locationApi = inject(WarehouseLocationApiService);
  private readonly supplierApi = inject(SupplierApiService);

  private readonly goodsIssueApi = inject(GoodsIssueApiService);
  private readonly goodsIssueDetailApi = inject(GoodsIssueDetailApiService);

  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  readonly loading = computed(() => this.goodsIssueApi.loading() || this.goodsIssueDetailApi.loading());

  /** Ordered the way the product screen's type picker will show them. */
  readonly types = computed(() =>
    [...this.goodsIssueApi.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.issueNo.localeCompare(b.issueNo)));

  // ─── Lookups ────────────────────────────────────────────────────────────────

  unitLabel(id?: number | null): string {
    const unit = this.unitApi.items().find(u => u.id === id);
    return unit ? (unit.symbol || unit.unitCode) : '';
  }

  productLabel(id?: number | null): string {
    const product = this.productApi.items().find(p => p.id === id);
    return product ? `${product.productCode} · ${product.productName}` : '';
  }

  warehouseLabel(id?: number | null): string {
    const warehouse = this.warehouseApi.items().find(w => w.id === id);
    return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
  }

  locationLabel(id?: number | null): string {
    const location = this.locationApi.items().find(l => l.id === id);
    return location ? `${location.warehouseLocationCode} · ${location.warehouseLocationName}` : '';
  }

  supplierLabel(id?: number | null): string {
    const supplier = this.supplierApi.items().find(s => s.id === id);
    return supplier ? `${supplier.supplierCode} · ${supplier.supplierName}` : '';
  }

  issueTypeLabel(value: number): string {
    const type = GOODS_ISSUE_STATUSES.find(s => s.value === value);
    return type ? this.i18n.t(type.labelKey) : '';
  }

  statusLabel(value: number): string {
    const type = GOODS_ISSUE_STATUSES.find(s => s.value === value);
    return type ? this.i18n.t(type.labelKey) : '';
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
    GOODS_ISSUE_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

  readonly statusOptions = computed(() =>
    GOODS_ISSUE_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

  readonly warehouseOptions = computed(() =>
    this.warehouseApi.items()
      .filter(w => w.isActive)
      .map(w => ({ label: `${w.warehouseCode} · ${w.warehouseName}`, value: w.id })));

  readonly locationOptions = computed(() =>
    this.locationApi.items()
      .filter(l => l.isActive)
      .map(l => ({ label: `${l.warehouseLocationCode} · ${l.warehouseLocationName}`, value: l.id })));

  readonly supplierOptions = computed(() =>
    this.supplierApi.items()
      // .filter(s => s.a)
      .map(s => ({ label: `${s.supplierCode} · ${s.supplierName}`, value: s.id })));

  // ─── Selection ──────────────────────────────────────────────────────────────

  readonly selectedIssue = signal<GoodsIssueDto | null>(null);
  readonly selectedDetail = signal<GoodsIssueDetailDto | null>(null);

  /** Type filter above the product list — the first thing an operator reaches for. */
  readonly typeFilter = signal<string | null>(null);


  readonly issue = computed(() => {
    const typeId = this.typeFilter();
    const all = this.goodsIssueApi.items();
    return typeId === null ? all : all.filter(p => p.issueNo === typeId);
  });

  readonly issueDetail = computed(() => {
    const issueId = this.selectedIssue()?.id;
    if (issueId == null) return [];
    return this.goodsIssueDetailApi.items().filter(b => b.goodsIssueId === issueId);
  });

  /** Receipts the backend holds with no id. No panel here can reach them. */
  readonly unassignedReceipts = computed(() =>
    this.goodsIssueApi.items().filter(b => b.id == null).length);

  constructor() {
    // The toolbar still gates through `*appHasPermission`: its `<ng-template>` already
    // binds a `canAdd` context variable meaning "a row can be added right now", which
    // would shadow the inherited signal of the same name.
    super(PERMISSIONS.goodsIssue);

    effect(() => {
      const issue = this.issue();
      untracked(() => this.selectedIssue.set(this._reconcile(this.selectedIssue(), issue)));
    });

    effect(() => {
      const details = this.issueDetail();
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
      issue: this.goodsIssueApi.load(),
      details: this.goodsIssueDetailApi.load(),
      products: this.productApi.load(),
      units: this.unitApi.load(),
      warehouse: this.warehouseApi.load(),
      location: this.locationApi.load(),
    }).subscribe({
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('goodsIssue.err.load'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly issueTable = viewChild<Table>('issueTable');
  private readonly detailTable = viewChild<Table>('detailTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    goodsIssue: ['issueNo'],
    goodsIssueDetail: [],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = { goodsIssue: this.issueTable(), goodsIssueDetail: this.detailTable() }[kind];
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'goodsIssue') {
      this.selectedIssue.set(this._reconcile(this.selectedIssue(), visible as GoodsIssueDto[]));
    } else if (kind === 'goodsIssueDetail') {
      this.selectedDetail.set(this._reconcile(this.selectedDetail(), visible as GoodsIssueDetailDto[]));
    }
  }

  selectIssue(issue: GoodsIssueDto): void {
    if (this.selectedIssue()?.id === issue.id) return;
    this.selectedIssue.set(issue);
  }

  selectDetail(detail: GoodsIssueDetailDto): void {
    this.selectedDetail.set(detail);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  form = this._emptyForm();

  /**
   * Working copy of the issue's lines while the dialog is open. Editing happens in the
   * grid itself, so these must be clones — binding straight to `goodsIssueDetailApi.items()`
   * would rewrite the service's cache before anything reached the server, and cancelling
   * would leave the page showing edits that were never saved.
   *
   * Lines the operator adds get a negative id so the grid can key them apart; `_saveIssue()`
   * sends those as 0, which the backend reads as "new".
   */
  readonly detailRows = signal<GoodsIssueDetailDto[]>([]);
  private _tempDetailId = 0;

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this.i18n.t('goodsIssue.lower'),
    }));

  /**
   * Running total of the lines — the number the operator checks against the delivery note.
   * A method rather than a `computed`: the grid edits row objects in place so the array
   * identity never changes, and rebuilding it on every keystroke would re-render the rows
   * and pull focus out of the cell being typed into.
   */
  detailTotal(): number {
    return this.detailRows().reduce((sum, row) => sum + (row.quantity ?? 0) * (row.unitPrice ?? 0), 0);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), issueNo: this._nextIssueNo() };
    // An issue with no line is meaningless, so start the operator on one.
    this.detailRows.set([this._emptyDetailRow()]);
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selectedIssue();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');

    this.form = {
      issueNo: row.issueNo ?? '',
      issueType: row.issueType ?? null,
      warehouseId: row.warehouseId ?? 0,
      referenceType: row.referenceType?.trim() ?? '',
      referenceId: row.referenceId ?? null,
      issueDate: this._toLocalInput(row.issueDate),
      status: row.status ?? 1,
      remark: row.remark?.trim() || '',
      // Carried untouched: the backend maps the whole payload onto the entity, so leaving
      // these out of the PUT would blank the approval and posting trail.
      approvedBy: row.approvedBy ?? null,
      approvedDate: row.approvedDate ?? null,
      postedBy: row.postedBy ?? null,
      postedDate: row.postedDate ?? null,
    };
    this.detailRows.set(
      this.goodsIssueDetailApi.items()
        .filter(d => d.goodsIssueId === row.id)
        .map(d => ({ ...d })));
    this.dialogOpen.set(true);
  }

  // ─── Detail grid ────────────────────────────────────────────────────────────

  addDetailRow(): void {
    this.detailRows.update(rows => [...rows, this._emptyDetailRow()]);
  }

  removeDetailRow(row: GoodsIssueDetailDto): void {
    // No bookkeeping for lines the server already stores: the save sends the whole set and
    // the backend deletes whatever is missing from it.
    this.detailRows.update(rows => rows.filter(r => r !== row));
  }

  /** Picking a product pulls in its default unit; the operator can still override it. */
  onDetailProductChange(row: GoodsIssueDetailDto, productId: number | null): void {
    row.productId = productId ?? 0;
    const product = this.productApi.items().find(p => p.id === productId);
    row.unitId = product?.defaultUnitId ?? row.unitId;
  }

  /** Received quantity tracks the ordered one until someone edits it apart. */
  // onDetailQuantityChange(row: GoodsIssueDetailDto, quantity: number | null): void {
  //   const prev = row.quantity ?? 0;
  //   const next = quantity ?? 0;
  //   if (row.receivedQty === prev) {
  //     row.receivedQty = next;
  //   }
  //   row.quantity = next;
  // }


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
    this._saveIssue(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t('goodsIssue.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('goodsIssue.lower') }));
      },
    });
  }


  askDelete(): void {
    const row = this.selectedIssue();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('goodsIssue.lower') }),
      message: `${this.i18n.t('plant.confirm.message', { label: row.issueNo })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still used by products" rule and returns its own message.
      accept: () => this.goodsIssueApi.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.issueNo })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('goodsIssue.lower') }), err),
      }),
    });
  }


  askApprove(isApprove: boolean): void {
    const row = this.selectedIssue();
    if (!row) return;

    const headerKey = isApprove ? 'plant.confirm.approve.title' : 'plant.confirm.unapprove.title';
    const messageKey = isApprove ? 'plant.confirm.approve.message' : 'plant.confirm.unapprove.message';
    const acceptLabelKey = isApprove ? 'common.approve' : 'common.unapprove';

    this.confirm.confirm({
      header: this.i18n.t(headerKey, { entity: this.i18n.t('goodsIssue.lower') }),
      message: `${this.i18n.t(messageKey, { label: row.issueNo })}`,
      acceptLabel: this.i18n.t(acceptLabelKey),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: isApprove ? 'p-button-success' : 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still used by products" rule and returns its own message.
      accept: () => this._approveIssue(row.id, isApprove).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogOpen.set(false);
          this.reload();
          this._ok(this.i18n.t(isApprove ? 'plant.ok.approved' : 'plant.ok.unapproved', {
            label: row.issueNo
          }));
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(err.error?.message
            || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('goodsIssue.lower') }));
        },
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm() {
    return {
      issueNo: '',
      issueType: null as number | null,
      warehouseId: 0,
      referenceType: '',
      referenceId: null as number | null,
      issueDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
      status: 1,
      remark: '',
      approvedBy: null as number | null,
      approvedDate: null as string | null,
      postedBy: null as number | null,
      postedDate: null as string | null,
    };
  }

  private _emptyDetailRow(): GoodsIssueDetailDto {
    return {
      id: --this._tempDetailId,
      goodsIssueId: this.editingId() ?? 0,
      productId: 0,
      unitId: 0,
      locationId: 0,
      lotNo: '',
      serialNo: '',
      quantity: 1,
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

  private _nextIssueNo(): string {
    const prefix = 'GI';

    const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
    const prefixWithDate = `${prefix}_${datePart}_`;

    const existing = this.issue().filter(r =>
      r.issueNo.startsWith(prefixWithDate),
    );

    let stt = 1;

    if (existing.length > 0) {
      const numbers = existing
        .map(r => {
          const match = r.issueNo.match(
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
    const issueNo = this.form.issueNo.trim();

    if (!issueNo) {
      return this.i18n.t('goodsIssue.err.issueNoRequired');
    }

    if (!this.form.issueDate) {
      return this.i18n.t('goodsIssue.err.issueDateRequired');
    }

    if (!this.form.status) {
      return this.i18n.t('goodsIssue.err.statusRequired');
    }

    // IssueNo is unique across the entire goods issue list.
    const clash = this.goodsIssueApi.items().find(
      issue =>
        issue.issueNo.toLowerCase() === issueNo.toLowerCase() &&
        issue.id !== this.editingId(),
    );

    return clash
      ? this.i18n.t('goodsIssue.err.issueNoTaken', { issueNo })
      : '';
  }

  /** Reports the first bad line by its position — the operator reads the grid by row, not by id. */
  private _validateDetails(): string {
    const rows = this.detailRows();
    if (rows.length === 0) return this.i18n.t('goodsIssueDetail.err.linesRequired');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 1;

      if (!row.productId) return this.i18n.t('goodsIssueDetail.err.productRequired', { line });
      if (!row.unitId) return this.i18n.t('goodsIssueDetail.err.unitRequired', { line });
      if (!row.quantity || row.quantity <= 0) return this.i18n.t('goodsIssueDetail.err.quantityRequired', { line });
      // if (row.receivedQty == null || row.receivedQty < 0) {
      //   return this.i18n.t('goodsIssueDetail.err.receivedQtyInvalid', { line });
      // }
    }

    return '';
  }

  private _saveIssue(id: number | null): Observable<GoodsIssueDto> {
    const body: GoodsIssueRequest = {
      issueNo: this.form.issueNo.trim(),
      issueType: this.form.issueType ?? 1,
      warehouseId: this.form.warehouseId,
      referenceType: this.form.referenceType?.trim() || null,
      referenceId: this.form.referenceId,
      issueDate: this.form.issueDate,
      status: this.form.status ?? 1,
      remark: this.form.remark?.trim() || null,
      approvedBy: this.form.approvedBy,
      approvedDate: this.form.approvedDate,
      postedBy: this.form.postedBy,
      postedDate: this.form.postedDate,
      // The whole line set every time: the backend replaces what it holds, which is how a
      // line the operator removed from the grid gets deleted.
      goodsIssueDetails: this.detailRows().map(row => ({
        // Drafts carry a negative id so the grid can key them; the server reads 0 as "new".
        id: row.id > 0 ? row.id : 0,
        goodsIssueId: row.goodsIssueId ?? 0,
        productId: row.productId,
        unitId: row.unitId,
        locationId: row.locationId ?? null,
        lotNo: row.lotNo?.trim() || null,
        serialNo: row.serialNo?.trim() || null,
        quantity: row.quantity ?? null,
        unitPrice: row.unitPrice ?? null,
        remark: row.remark?.trim() || null,
      })),
    };
    return id ? this.goodsIssueApi.update(id, body) : this.goodsIssueApi.create(body);
  }

  private _approveIssue(id: number | null, isApprove: boolean): Observable<GoodsIssueDto> {
    if (id == null) {
      return throwError(() => new Error(this.i18n.t('goodsIssue.err.notFound')));
    }

    const issue = this.goodsIssueApi.items().find(r => r.id === id);
    if (!issue) {
      return throwError(() => new Error(this.i18n.t('goodsIssue.err.notFound')));
    }

    const body: GoodsIssueRequest = {
      issueNo: issue.issueNo,
      warehouseId: issue.warehouseId,
      referenceType: issue.referenceType ?? null,
      referenceId: issue.referenceId,
      issueDate: issue.issueDate,
      remark: issue.remark ?? null,

      approvedBy: issue.approvedBy,
      approvedDate: isApprove
        ? formatDate(new Date(), DATETIME_LOCAL, 'en-US')
        : null,

      postedBy: issue.postedBy,
      postedDate: issue.postedDate,

      issueType: issue.issueType ?? 1,
      status: issue.status ?? 1,
    };

    return this.goodsIssueApi.update(id, body);
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
