import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { WarehouseApiService, WarehouseLocationApiService } from '../../core/services/warehouse-api.service';
import { SupplierApiService } from '../../core/services/master-data-api.service';
import { PurchaseOrderApiService, PurchaseOrderDeliveryScheduleApiService, PurchaseOrderDetailApiService } from '../../core/services/purchase-order-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { PURCHASE_ORDER_STATUSES, PurchaseOrderDeliveryScheduleDto, PurchaseOrderDeliveryScheduleRequest, PurchaseOrderDetailDto, PurchaseOrderDetailRequest, PurchaseOrderDto, PurchaseOrderRequest } from '../../domain/models/purchase-order.model';
import { productStatusOf } from '../../domain/models/product.model';
import { forkJoin, Observable, throwError } from 'rxjs';
import { PERMISSIONS } from '../../core/auth/permissions';
import { HttpErrorResponse } from '@angular/common/http';
import { ChevronDownIcon, ChevronRightIcon } from 'primeng/icons';
import { TabsModule } from 'primeng/tabs';
import { ListboxModule } from 'primeng/listbox';

type EntityKind = 'po' | 'poDetail' | 'deliverySchedule';

const DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm";

interface ProductOption {
	value: number;
	label: string;
	code: string;
	name: string;
	unit: string;
	drawingNo: string;
	statusLabel: string;
	statusSeverity: 'success' | 'danger' | undefined;
}

interface PoDetailOption {
	value: number;
	label: string;
	productCode: string;
	productName: string;
	unit: string;
	quantity: number;
	unitPrice: number;
}

@Component({
	selector: 'app-purchase-order',
	standalone: true,
	imports: [
		CommonModule, FormsModule,
		TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
		InputTextModule, TextareaModule, SelectModule, TagModule, ToggleSwitchModule,
		HasPermissionDirective, PanelModule, CardModule, InputNumberModule, AutoCompleteModule,
		ChevronDownIcon, ChevronRightIcon, TabsModule, ListboxModule
	],
	providers: [MessageService, ConfirmationService],
	templateUrl: './purchase-order.component.html',
	styleUrl: './purchase-order.component.scss',
})
export class PurchaseOrderComponent extends PermissionAwarePage implements OnInit {
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly locationApi = inject(WarehouseLocationApiService);
	private readonly supplierApi = inject(SupplierApiService);

	private readonly poApi = inject(PurchaseOrderApiService);
	private readonly detailApi = inject(PurchaseOrderDetailApiService);
	private readonly scheduleApi = inject(PurchaseOrderDeliveryScheduleApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);

	readonly loading = computed(() => this.poApi.loading() || this.detailApi.loading() || this.scheduleApi.loading());

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

	statusLabel(value: number): string {
		const type = PURCHASE_ORDER_STATUSES.find(s => s.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	readonly unitOptions = computed(() =>
		this.unitApi.items()
			.filter(u => u.isActive)
			.map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	/** Feeds the per-row picker in the detail grid — `filterBy` searches both code and name,
	 *  so the label carries the two fields an operator types. */
	// readonly productOptions = computed(() =>
	//   this.productApi.items()
	//     .map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id })));

	readonly productOptions = computed<ProductOption[]>(() => {
		const units = new Map(this.unitApi.items().map(u => [u.id, u.symbol || u.unitCode]));

		return this.productApi.items().map(p => {
			const status = productStatusOf(p.status);
			return {
				value: p.id,
				label: `${p.productCode} · ${p.productName}`,
				code: p.productCode,
				name: p.productName,
				unit: (p.defaultUnitId != null ? units.get(p.defaultUnitId) : '') ?? '',
				drawingNo: p.drawingNo ?? '',
				statusLabel: status ? this.i18n.t(status.labelKey) : '',
				statusSeverity: status?.severity,
			};
		});
	});

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items()
			.filter(w => w.isActive)
			.map(w => ({ label: `${w.warehouseCode} · ${w.warehouseName}`, value: w.id })));



	// readonly locationOptions = (productId: number | null): LocationOption[] => {
	// 	if (!productId) {
	// 		return [];
	// 	}

	// 	const locations = this.inventoryApi.items()
	// 		.filter(x => x.productId === productId)
	// 		.map(p => ({
	// 			value: p.id,
	// 			label: `${p.warehouseLocationCode} · ${p.warehouseLocationName}`,
	// 			code: p.warehouseLocationCode ?? '',
	// 			name: p.warehouseLocationName ?? '',
	// 			availableQuantity: p.availableQuantity ?? 0,
	// 			disabled: (p.availableQuantity ?? 0) <= 0,
	// 		}));

	// 	console.log('locations:', locations);

	// 	return locations;
	// };

	readonly supplierOptions = computed(() =>
		this.supplierApi.items()
			// .filter(s => s.a)
			.map(s => ({ label: `${s.supplierCode} · ${s.supplierName}`, value: s.id })));

	readonly statusOptions = computed(() =>
		PURCHASE_ORDER_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly currencyOptions = computed(() =>
		PURCHASE_ORDER_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly paymentTermOptions = computed(() =>
		PURCHASE_ORDER_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly deliveryTermOptions = computed(() =>
		PURCHASE_ORDER_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly employeeOptions = computed(() =>
		PURCHASE_ORDER_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly detailOptions = computed<PoDetailOption[]>(() => {

		const details = this.detailApi.items()
			.filter(p => p.purchaseOrderId === this.selectedPo()?.id)
			.map(p => {
				return {
					value: p.id,
					label: `${this.productLabel(p.productId)} · ${p.quantity}`,
					productCode: this.productLabel(p.productId),
					productName: this.unitLabel(p.unitId),
					unit: this.unitLabel(p.unitId),
					quantity: p.quantity ?? 0,
					unitPrice: p.unitPrice ?? 0,
				};
			});
		// console.log('details:', details);

		return details
	});

	// ─── Selection ──────────────────────────────────────────────────────────────

	readonly selectedPo = signal<PurchaseOrderDto | null>(null);
	readonly selectedDetail = signal<PurchaseOrderDetailDto | null>(null);
	readonly selectedSchedule = signal<PurchaseOrderDeliveryScheduleDto | null>(null);

	/** Type filter above the product list — the first thing an operator reaches for. */
	readonly typeFilter = signal<string | null>(null);


	readonly po = computed(() => {
		const typeId = this.typeFilter();
		const all = this.poApi.items();
		return typeId === null ? all : all.filter(p => p.pono === typeId);
	});

	readonly poDetail = computed(() => {
		const id = this.selectedPo()?.id;
		if (id == null) return [];
		return this.detailApi.items().filter(b => b.purchaseOrderId === id);
	});

	// readonly schedule = computed(() => {
	// 	const id = this.selectedDetail()?.id;
	// 	if (id == null) return [];
	// 	return this.scheduleApi.items().filter(b => b.purchaseOrderDetailId === id);
	// });

	schedule(row: PurchaseOrderDetailDto) {
		return this.scheduleApi.items().filter(
			x => x.purchaseOrderDetailId === row.id
		);
	}

	/** Receipts the backend holds with no id. No panel here can reach them. */
	readonly unassignedReceipts = computed(() =>
		this.poApi.items().filter(b => b.id == null).length);

	readonly isScheduleChanged = signal(false);

	constructor() {
		// The toolbar still gates through `*appHasPermission`: its `<ng-template>` already
		// binds a `canAdd` context variable meaning "a row can be added right now", which
		// would shadow the inherited signal of the same name.
		super(PERMISSIONS.purchaseOrder);

		effect(() => {
			const po = this.po();
			untracked(() => this.selectedPo.set(this._reconcile(this.selectedPo(), po)));
		});

		effect(() => {
			const details = this.poDetail();
			untracked(() => this.selectedDetail.set(this._reconcile(this.selectedDetail(), details)));
		});

		// effect(() => {
		// 	const schedules = this.schedule();
		// 	untracked(() => this.selectedSchedule.set(this._reconcile(this.selectedSchedule(), schedules)));
		// });
		effect(() => {
			this.scheduleRows();
			this.isScheduleChanged.set(true);
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		// Products and units are not just labels here — the detail grid's row pickers are
		// driven from them, so an empty list would leave every line unfillable.
		forkJoin({
			pos: this.poApi.load(),
			details: this.detailApi.load(),
			products: this.productApi.load(),
			schedules: this.scheduleApi.load(),
			units: this.unitApi.load(),
			warehouse: this.warehouseApi.load(),
			suppliers: this.supplierApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('purchaseOrder.err.load'), err),
		});
	}

	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly poTable = viewChild<Table>('poTable');
	private readonly detailTable = viewChild<Table>('detailTable');
	private readonly scheduleTable = viewChild<Table>('scheduleTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		po: ['pono'],
		poDetail: [],
		deliverySchedule: [],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = { po: this.poTable(), poDetail: this.detailTable(), deliverySchedule: this.scheduleTable() }[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'po') {
			this.selectedPo.set(this._reconcile(this.selectedPo(), visible as PurchaseOrderDto[]));
		} else if (kind === 'poDetail') {
			this.selectedDetail.set(this._reconcile(this.selectedDetail(), visible as PurchaseOrderDetailDto[]));
		} else if (kind === 'deliverySchedule') {
			this.selectedSchedule.set(this._reconcile(this.selectedSchedule(), visible as PurchaseOrderDeliveryScheduleDto[]));
		}
	}

	selectPo(po: PurchaseOrderDto): void {
		if (this.selectedPo()?.id === po.id) return;
		this.selectedPo.set(po);
	}

	selectDetail(detail: PurchaseOrderDetailDto): void {
		if (this.selectedDetail()?.id === detail.id) return;
		this.selectedDetail.set(detail);
	}
	selectSchedule(schedule: PurchaseOrderDeliveryScheduleDto): void {
		this.selectedSchedule.set(schedule);
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly activeTab = signal<string>('info');
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();
	formSchedule = this._emptyScheduleForm();

	readonly detailRows = signal<PurchaseOrderDetailDto[]>([]);
	readonly scheduleRows = signal<PurchaseOrderDeliveryScheduleDto[]>([]);
	private _tempDetailId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('purchaseOrderDetail.lower'),
		}));

	detailTotal(): number {
		return this.detailRows().reduce((sum, row) => sum + (row.quantity ?? 0) * (row.unitPrice ?? 0), 0);
	}

	scheduleTotalQuantity(): number {
		return this.scheduleRows().reduce((sum, row) => sum + (row.quantity ?? 0), 0);
	}



	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), pono: this._nextPoNo() };
		// An issue with no line is meaningless, so start the operator on one.
		this.detailRows.set([this._emptyDetailRow()]);
		this.scheduleRows.set([this._emptyScheduleRow()]);
		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPo();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		// console.log("row:", row);

		this.form = {
			id: row.id,

			pono: row.pono ?? '',
			supplierId: row.supplierId ?? 0,
			orderDate: this._toLocalInput(row.orderDate),
			expectedDeliveryDate: this._toLocalInput(row.expectedDeliveryDate) || null,
			status: row.status ?? 1,

			currencyId: row.currencyId ?? null,
			exchangeRate: row.exchangeRate ?? null,
			paymentTermId: row.paymentTermId ?? null,
			deliveryTermId: row.deliveryTermId ?? null,
			employeeId: row.employeeId ?? null,

			requestedDate: this._toLocalInput(row.requestedDate) || null,

			subTotal: row.subTotal ?? 0,
			discountAmount: row.discountAmount ?? 0,
			taxAmount: row.taxAmount ?? 0,
			shippingAmount: row.shippingAmount ?? 0,
			otherAmount: row.otherAmount ?? 0,
			totalAmount: row.totalAmount ?? 0,

			remark: row.remark?.trim() ?? null,
		};

		this.detailRows.set(
			this.detailApi.items()
				.filter(d => d.purchaseOrderId === row.id)
				.map(d => ({ ...d })));

		this.scheduleRows.set(
			this.scheduleApi.items()
				.filter(s => s.purchaseOrderDetailId === this.formSchedule.purchaseOrderDetailId)
				.map(s => ({ ...s })));

		this.dialogOpen.set(true);
	}

	// ─── Detail grid ────────────────────────────────────────────────────────────

	addDetailRow(): void {
		this.detailRows.update(rows => [...rows, this._emptyDetailRow()]);
	}

	removeDetailRow(row: PurchaseOrderDetailDto): void {
		// No bookkeeping for lines the server already stores: the save sends the whole set and
		// the backend deletes whatever is missing from it.
		this.detailRows.update(rows => rows.filter(r => r !== row));
	}

	/** Picking a product pulls in its default unit; the operator can still override it. */
	onDetailProductChange(row: PurchaseOrderDetailDto, productId: number | null): void {
		row.productId = productId ?? 0;
		const product = this.productApi.items().find(p => p.id === productId);
		// const receipDetail = this.goodsReceiptDetailApi.items().find(p => p.productId === productId);
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

	// ─── Schedule grid ────────────────────────────────────────────────────────────

	private _currentDetailId: number | null = null;

	/** Snapshot schedule ban đầu của từng Detail */
	private _originalSchedules = new Map<number, string>();

	/** Trạng thái changed của từng Detail */
	private _scheduleChanged = new Map<number, boolean>();

	addScheduleRow(): void {
		// this.scheduleRows.update(rows => [...rows, this._emptyScheduleRow()]);
		const detailId = this._currentDetailId;
		if (detailId == null) return;

		const row: PurchaseOrderDeliveryScheduleDto = {
			...this._emptyScheduleForm(),
			id: --this._tempDetailId,
			purchaseOrderDetailId: detailId
		};

		this.scheduleRows.update(rows => [...rows, row]);
	}

	removeScheduleRow(row: PurchaseOrderDeliveryScheduleDto): void {
		// No bookkeeping for lines the server already stores: the save sends the whole set and
		// the backend deletes whatever is missing from it.
		// this.scheduleRows.update(rows => rows.filter(r => r !== row));
		this.scheduleRows.update(rows => rows.filter(x => x.id !== row.id));
	}

	onDetailPOChange(detailId: number | null): void {
		// ============================
		// 1. Check Detail cũ trước khi đổi
		// ============================
		if (this._currentDetailId != null) {
			const currentDetailId = this._currentDetailId;

			const changed = this.hasScheduleChanged(currentDetailId);

			this._scheduleChanged.set(currentDetailId, changed);

			console.log(
				`Detail ${currentDetailId} schedule changed:`,
				changed, this.scheduleRows()
			);

			if (changed) {
				// One call carrying the header and every line: the backend writes them in a single
				// transaction, so a rejected line cannot leave a receipt behind.
				this._saveSchedule(currentDetailId).subscribe({
					next: () => {
						// this.saving.set(false);
						// this.dialogOpen.set(false);
						this.reload();
						this._ok(this.i18n.t(currentDetailId ? 'plant.ok.updated' : 'plant.ok.created', {
							entity: this.i18n.t('purchaseOrderDeliverySchedule.lower'),
						}));
					},
					error: (err: HttpErrorResponse) => {
						this.saving.set(false);
						this.formError.set(err.error?.message
							|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('purchaseOrder.lower') }));
					},
				});
			}
		}

		// ============================
		// 2. Đổi sang Detail mới
		// ============================
		this._currentDetailId = detailId;

		if (detailId == null) {
			this.scheduleRows.set([]);
			return;
		}

		// ============================
		// 3. Lấy schedule của Detail mới
		// ============================
		const rows = this.scheduleApi.items()
			.filter(s => s.purchaseOrderDetailId === detailId)
			.map(s => ({ ...s }));

		// ============================
		// 4. Lưu snapshot ban đầu
		// ============================
		if (!this._originalSchedules.has(detailId)) {
			this._originalSchedules.set(
				detailId,
				JSON.stringify(rows)
			);

			this._scheduleChanged.set(
				detailId,
				false
			);
		}

		// ============================
		// 5. Hiển thị schedule của Detail mới
		// ============================
		this.scheduleRows.set(rows);
	}

	hasScheduleChanged(detailId: number): boolean {
		const original =
			this._originalSchedules.get(detailId) ?? '[]';

		const current = JSON.stringify(
			this.scheduleRows()
		);

		return original !== current;
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
		this._savePO(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('purchaseOrder.lower'),
				}));


				this._saveSchedule(this.formSchedule.purchaseOrderDetailId).subscribe({
					next: () => {
						// this.saving.set(false);
						// this.dialogOpen.set(false);
						this.reload();
						this._ok(this.i18n.t(this.formSchedule.purchaseOrderDetailId ? 'plant.ok.updated' : 'plant.ok.created', {
							entity: this.i18n.t('purchaseOrderDeliverySchedule.lower'),
						}));
					},
					error: (err: HttpErrorResponse) => {
						this.saving.set(false);
						this.formError.set(err.error?.message
							|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('purchaseOrder.lower') }));
					},
				});
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('purchaseOrder.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedPo();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('purchaseOrder.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.pono })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.poApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.pono })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('purchaseOrder.lower') }), err),
			}),
		});
	}

	askApprove(isApprove: boolean): void {
		const row = this.selectedPo();
		if (!row) return;

		const headerKey = isApprove ? 'plant.confirm.approve.title' : 'plant.confirm.unapprove.title';
		const messageKey = isApprove ? 'plant.confirm.approve.message' : 'plant.confirm.unapprove.message';
		const acceptLabelKey = isApprove ? 'common.approve' : 'common.unapprove';

		this.confirm.confirm({
			header: this.i18n.t(headerKey, { entity: this.i18n.t('purchaseOrder.lower') }),
			message: `${this.i18n.t(messageKey, { label: row.pono })}`,
			acceptLabel: this.i18n.t(acceptLabelKey),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: isApprove ? 'p-button-success' : 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this._approvePO(row.id, isApprove).subscribe({
				next: () => {
					this.saving.set(false);
					this.dialogOpen.set(false);
					this.reload();
					this._ok(this.i18n.t(isApprove ? 'plant.ok.approved' : 'plant.ok.unapproved', {
						label: row.pono
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
			id: 0,

			pono: '',
			supplierId: 0,
			orderDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			expectedDeliveryDate: null as string | null,
			status: 1,

			currencyId: null as number | null,
			exchangeRate: null as number | null,
			paymentTermId: null as number | null,
			deliveryTermId: null as number | null,
			employeeId: null as number | null,

			requestedDate: null as string | null,

			subTotal: 0,
			discountAmount: 0,
			taxAmount: 0,
			shippingAmount: 0,
			otherAmount: 0,
			totalAmount: 0,

			remark: null as string | null,
		};
	}

	private _emptyDetailRow(): PurchaseOrderDetailDto {
		return {
			id: --this._tempDetailId,
			purchaseOrderId: 0,
			stt: 0,
			productId: 0,
			unitId: 0,
			requiredDate: null as string | null,
			quantity: 0,
			receivedQuantity: 0,
			rejectedQuantity: 0,
			unitPrice: 0,
			discountPercent: 0,
			discountAmount: 0,
			taxPercent: 0,
			taxAmount: 0,
			totalAmount: 0,
			warehouseId: null as number | null,
			remark: null as string | null
		};
	}

	private _emptyScheduleForm(): PurchaseOrderDeliveryScheduleDto {
		return {
			id: 0,
			purchaseOrderDetailId: this._currentDetailId ?? 0,
			deliveryDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			quantity: 0,
		};
	}

	private _emptyScheduleRow(): PurchaseOrderDeliveryScheduleDto {
		return {
			id: --this._tempDetailId,
			purchaseOrderDetailId: this.formSchedule.purchaseOrderDetailId,
			deliveryDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			quantity: 0,
		};
	}

	/** The backend sends an ISO string with seconds and an offset; the input wants neither. */
	private _toLocalInput(value: string | null | undefined): string {
		if (!value) return '';
		const date = new Date(value);
		return isNaN(date.getTime()) ? '' : formatDate(date, DATETIME_LOCAL, 'en-US');
	}

	private _nextPoNo(): string {
		const prefix = 'PO';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.po().filter(r =>
			r.pono.startsWith(prefixWithDate),
		);

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.pono.match(
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
		const pono = this.form.pono.trim();

		if (!pono) {
			return this.i18n.t('purchaseOrder.err.poNoRequired');
		}

		if (!this.form.orderDate) {
			return this.i18n.t('purchaseOrder.err.orderDateRequired');
		}

		if (!this.form.supplierId) {
			return this.i18n.t('purchaseOrder.err.supplierRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.po().find(
			po =>
				po.pono.toLowerCase() === pono.toLowerCase() &&
				po.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('purchaseOrder.err.poNoTaken', { pono })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */
	private _validateDetails(): string {
		const rows = this.detailRows();
		if (rows.length === 0) return this.i18n.t('purchaseOrderDetail.err.linesRequired');

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const line = i + 1;

			if (!row.productId) return this.i18n.t('purchaseOrderDetail.err.productRequired', { line });
			if (!row.unitId) return this.i18n.t('purchaseOrderDetail.err.unitRequired', { line });
			if (!row.quantity || row.quantity <= 0) return this.i18n.t('purchaseOrderDetail.err.quantityRequired', { line });

		}

		return '';
	}

	private _savePO(id: number | null): Observable<PurchaseOrderDto> {
		const body: PurchaseOrderRequest = {
			pono: this.form.pono.trim(),
			supplierId: this.form.supplierId ?? 0,
			orderDate: this.form.orderDate,
			expectedDeliveryDate: this.form.expectedDeliveryDate || null,
			currencyId: this.form.currencyId,
			exchangeRate: this.form.exchangeRate,
			paymentTermId: this.form.paymentTermId,
			deliveryTermId: this.form.deliveryTermId,
			employeeId: this.form.employeeId,
			requestedDate: this.form.requestedDate,
			subTotal: this.form.subTotal,
			discountAmount: this.form.discountAmount,
			taxAmount: this.form.taxAmount,
			shippingAmount: this.form.shippingAmount,
			otherAmount: this.form.otherAmount,
			totalAmount: this.form.totalAmount,
			status: this.form.status,
			remark: this.form.remark?.trim() || null,

			// The whole line set every time: the backend replaces what it holds, which is how a
			// line the operator removed from the grid gets deleted.
			purchaseOrderDetailRequests: this.detailRows().map((row, i) => ({
				// Drafts carry a negative id so the grid can key them; the server reads 0 as "new".
				id: row.id > 0 ? row.id : 0,
				stt: i + 1,
				purchaseOrderId: row.purchaseOrderId ?? 0,
				productId: row.productId,
				unitId: row.unitId,
				requiredDate: row.requiredDate,
				quantity: row.quantity ?? null,
				receivedQuantity: row.receivedQuantity,
				rejectedQuantity: row.rejectedQuantity,
				unitPrice: row.unitPrice ?? null,
				discountPercent: row.discountPercent,
				discountAmount: row.discountAmount,
				taxPercent: row.taxPercent,
				taxAmount: row.taxAmount,
				totalAmount: row.totalAmount,
				warehouseId: row.warehouseId,
				remark: row.remark?.trim() || null,
			})),
		};
		return id ? this.poApi.update(id, body) : this.poApi.create(body);
	}

	private _approvePO(id: number | null, isApprove: boolean): Observable<PurchaseOrderDto> {
		if (id == null) {
			return throwError(() => new Error(this.i18n.t('purchaseOrder.err.notFound')));
		}

		const po = this.po().find(r => r.id === id);
		if (!po) {
			return throwError(() => new Error(this.i18n.t('purchaseOrder.err.notFound')));
		}

		const body: PurchaseOrderRequest = {
			pono: po.pono.trim(),
			supplierId: po.supplierId ?? 0,
			orderDate: po.orderDate,
			expectedDeliveryDate: po.expectedDeliveryDate || null,
			currencyId: po.currencyId,
			exchangeRate: po.exchangeRate,
			paymentTermId: po.paymentTermId,
			deliveryTermId: po.deliveryTermId,
			employeeId: po.employeeId,
			requestedDate: po.requestedDate || null,
			subTotal: po.subTotal,
			discountAmount: po.discountAmount,
			taxAmount: po.taxAmount,
			shippingAmount: po.shippingAmount,
			otherAmount: po.otherAmount,
			totalAmount: po.totalAmount,
			status: po.status,
			remark: po.remark?.trim() || null,

			approvedBy: po.approvedBy,
			approvedDate: isApprove ? formatDate(new Date(), DATETIME_LOCAL, 'en-US') : null,
		};

		return this.poApi.update(id, body);
	}

	private _saveSchedule(id: number | null): Observable<PurchaseOrderDetailDto> {
		const body: PurchaseOrderDetailRequest = {
			purchaseOrderId: 0,
			stt: 0,
			productId: 0,
			unitId: 0,
			requiredDate: null,
			quantity: 0,
			receivedQuantity: 0,
			rejectedQuantity: 0,
			unitPrice: 0,
			discountPercent: 0,
			discountAmount: 0,
			taxPercent: 0,
			taxAmount: 0,
			totalAmount: 0,
			warehouseId: 0,
			remark: '',
			purchaseOrderDeliveryScheduleRequests: this.scheduleRows().map((row, i) => ({
				id: row.id > 0 ? row.id : 0,
				purchaseOrderDetailId: row.purchaseOrderDetailId ?? 0,
				deliveryDate: row.deliveryDate,
				quantity: row.quantity ?? 0,
			})),
		};
		return id ? this.detailApi.update(id, body) : this.detailApi.create(body);
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
