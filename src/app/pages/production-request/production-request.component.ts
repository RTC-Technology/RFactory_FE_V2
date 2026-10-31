import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, input, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ProductionOrderComponent } from '../production-order/production-order.component';
import { I18nService } from '../../core/services/i18n.service';
import { UnitApiService, ProductApiService } from '../../core/services/product-api.service';
import { SaleOrderApiService, SaleOrderItemApiService, SaleOrderPaymentScheduleApiService, ProductionRequestApiService, ProductionRequestItemApiService } from '../../core/services/production-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { CurrencyApiService, CustomerApiService } from '../../core/services/master-data-api.service';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { getItemStatusOf, getPriorityOf, getStatusOf, PRODUCTION_REQUEST_ITEM_STATUS_ENUM, PRODUCTION_REQUEST_ITEM_STATUSES, PRODUCTION_REQUEST_PRIORITIES, PRODUCTION_REQUEST_PRIORITY_ENUM, PRODUCTION_REQUEST_STATUSES, PRODUCTION_REQUEST_STATUSES_ENUM, ProductionRequestDto, ProductionRequestItemDto, ProductionRequestItemRequest, ProductionRequestRequest, SalesOrderDto } from '../../domain/models/production.model';
import { productStatusOf } from '../../domain/models/product.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'productionRequest' | 'productionRequestItem';
const DATETIME_LOCAL = "yyyy-MM-dd";

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

@Component({
	selector: 'app-production-request',
	imports: [
		CommonModule,
		FormsModule,
		TableModule,
		ButtonModule,
		DialogModule,
		ConfirmDialogModule,
		ToastModule,
		InputTextModule,
		InputNumberModule,
		SelectModule,
		TagModule,
		ToggleSwitchModule,
		HasPermissionDirective,
		SplitterModule,
		Textarea,
		TagModule,
		TabsModule,
		CheckboxModule,
		ToggleButtonModule,
		ProductionOrderComponent
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './production-request.component.html',
	styleUrl: './production-request.component.scss',
})
export class ProductionRequestComponent extends PermissionAwarePage implements OnInit {
	readonly _saleOrderDto = input<SalesOrderDto | null>(null);

	private readonly productionRequestApi = inject(ProductionRequestApiService);
	private readonly productionRequestItemApi = inject(ProductionRequestItemApiService);

	private readonly saleOrderApi = inject(SaleOrderApiService);
	private readonly saleOrderItemApi = inject(SaleOrderItemApiService);

	private readonly customerApi = inject(CustomerApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	statusSeverity = getStatusOf;
	prioritySeverity = getPriorityOf;
	itemStatusSeverity = getItemStatusOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────
	saleOrderLabel(id?: number | null): string {
		if (id == null) return '';
		const saleOrder = this.saleOrderApi.items().find(u => u.id === id);
		return saleOrder ? `${saleOrder.orderNo}` : '';
	}

	saleOrderItemLabel(id?: number | null): string {
		if (id == null) return '';
		const saleOrderItem = this.saleOrderItemApi.items().find(u => u.id === id);
		return saleOrderItem ? `${saleOrderItem.productName}` : '';
	}

	customerLabel(id?: number | null): string {
		if (id == null) return '';
		const customer = this.customerApi.items().find(u => u.id === id);
		return customer ? `${customer.customerCode} · ${customer.customerName}` : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode}` : '';
	}

	unitLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? `${unit.unitCode} · ${unit.unitName}` : '';
	}

	priorityLabel(id?: number | null): string {
		if (id == null) return '';
		const priority = PRODUCTION_REQUEST_PRIORITIES.find(u => u.value === id);
		return priority ? this.i18n.t(priority.labelKey) : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PRODUCTION_REQUEST_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	itemStatusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PRODUCTION_REQUEST_ITEM_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	readonly saleOrderOptions = computed(() =>
		this.saleOrderApi.items()
			.map(u => ({ label: `${u.orderNo}`, value: u.id })));

	readonly saleOrderItemOptions = computed(() =>
		this.saleOrderItemApi.items().map(u => ({ label: `${u.productName}`, value: u.id })));

	readonly customerOptions = computed(() =>
		this.customerApi.items().map(u => ({ label: `${u.customerCode} · ${u.customerName}`, value: u.id })));

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

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	readonly priorityOptions = computed(() =>
		PRODUCTION_REQUEST_PRIORITIES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		PRODUCTION_REQUEST_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly itemStatusOptions = computed(() =>
		PRODUCTION_REQUEST_ITEM_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedRequest = signal<ProductionRequestDto | null>(null);
	readonly selectedItem = signal<ProductionRequestItemDto | null>(null);

	readonly productionRequests = computed(() => {
		const all = this.productionRequestApi.items();
		return all;
	});

	readonly productionRequestItems = computed(() => {
		const id = this.selectedRequest()?.id;
		if (id == null) return [];
		return this.productionRequestItemApi.items().filter(e => e.productionRequestId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly requestTable = viewChild<Table>('requestTable');
	private readonly itemTable = viewChild<Table>('itemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		productionRequest: ['requestNo', 'salesOrderNo', 'description', 'remark'],
		productionRequestItem: ['productCode', 'productName', 'remark'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			productionRequest: this.requestTable(),
			productionRequestItem: this.itemTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'productionRequest') {
			this.selectedRequest.set(this._reconcile(this.selectedRequest(), visible as ProductionRequestDto[]));
		} else if (kind === 'productionRequestItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as ProductionRequestItemDto[]));
		}
	}

	selectRequest(request: ProductionRequestDto): void {
		if (this.selectedRequest()?.id === request.id) return;
		this.selectedRequest.set(request);
	}

	selectItem(item: ProductionRequestItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}
	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.productionRequest);

		effect(() => {
			const orders = this.productionRequests();
			untracked(() => this.selectedRequest.set(this._reconcile(this.selectedRequest(), orders)));
		});

		effect(() => {
			const items = this.productionRequestItems();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			productionRequests: this.productionRequestApi.load(),
			productionRequestItems: this.productionRequestItemApi.load(),

			salesOrders: this.saleOrderApi.load(),
			salesOrderItems: this.saleOrderItemApi.load(),

			customers: this.customerApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),

		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('productionRequest.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly orderOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly itemRows = signal<ProductionRequestItemDto[]>([]);

	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('productionRequest.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = {
			...this._emptyForm(),
			requestNo: this._nextRequestNo(),
		};

		if (this.itemRows().length == 0) {
			const requestDetails = this.saleOrderItemApi.items()
				.filter(x => x.salesOrderId === this._saleOrderDto()?.id)
				.map((d, i) => ({
					...this._emptyItemRow(),

					salesOrderItemId: d.id as number | null,
					productId: d.productId,
					productCode: d.productName as string | null,
					productName: d.productName as string | null,
					unitId: d.unitId as number | null,
					requestedQuantity: d.orderedQuantity,
					plannedQuantity: 0,
					producedQuantity: 0,
					requiredDate: d.expectedDeliveryDate ? formatDate(d.expectedDeliveryDate, DATETIME_LOCAL, 'en-US') : null as string | null,
					status: PRODUCTION_REQUEST_ITEM_STATUS_ENUM.PENDING,
					sortOrder: i + 1,
					remark: null as string | null,
				}));

			this.itemRows.set(requestDetails);
		} else {
			this.itemRows.set([]);
		}

		this.dialogOpen.set(true);
	}

	openOrder(): void {
		this.orderOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedRequest();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			requestNo: row.requestNo,
			salesOrderId: row.salesOrderId ?? null,
			salesOrderNo: row.salesOrderNo ?? null,
			customerId: row.customerId ?? null,
			requestDate: this._toLocalInput(row.requestDate) ?? formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			requiredDate: this._toLocalInput(row.requiredDate),
			receiptMaterialDate: this._toLocalInput(row.receiptMaterialDate),
			priority: row.priority,
			status: row.status,
			description: row.description ?? null,
			remark: row.remark ?? null,
		};

		this.itemRows.set(
			this.productionRequestItemApi.items()
				.filter(d => d.productionRequestId === row.id)
				.map(d => ({
					...d,
					requiredDate: this._toLocalInput(d.requiredDate)
				})));

		this.dialogOpen.set(true);
	}


	save(): void {
		const error = this._validate();
		if (error) {
			this.formError.set(error);
			return;
		}

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		// One call carrying the header and every line: the backend writes them in a single
		// transaction, so a rejected line cannot leave a receipt behind.
		this._saveOrder(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('productionRequest.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('productionRequest.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedRequest();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('productionRequest.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.requestNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.productionRequestApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.requestNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('productionRequest.lower') }), err),
			}),
		});
	}


	// ─── item grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
	}

	removeItemRow(row: ProductionRequestItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}

	onProductChange(productId: number | null, row: ProductionRequestItemDto): void {
		const product = this.productApi.items().find(m => m.id === productId);

		row.productCode = product?.productCode ?? row.productCode;
		row.productName = product?.productName ?? row.productName;
		row.unitId = product?.defaultUnitId ?? row.unitId;
	}
	onSalesOrderItemChange(salesOrderItemId: number | null, row: ProductionRequestItemDto): void {
		const saleOrderItem = this.saleOrderItemApi.items().find(m => m.id === salesOrderItemId);
		const product = this.productApi.items().find(m => m.id === saleOrderItem?.productId);

		row.productId = saleOrderItem?.productId ?? row.productId;
		row.productCode = product?.productCode ?? row.productCode;
		row.productName = product?.productName ?? row.productName;
		row.unitId = product?.defaultUnitId ?? row.unitId;
		row.requestedQuantity = saleOrderItem?.orderedQuantity ?? row.requestedQuantity;
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			requestNo: '',
			salesOrderId: this._saleOrderDto()?.id as number | null,
			salesOrderNo: this._saleOrderDto()?.orderNo as string | null,
			customerId: this._saleOrderDto()?.customerId as number | null,
			requestDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			requiredDate: this._saleOrderDto()?.expectedDeliveryDate ? formatDate(this._saleOrderDto()?.expectedDeliveryDate ?? '', DATETIME_LOCAL, 'en-US') : null as string | null,
			receiptMaterialDate: null as string | null,
			priority: PRODUCTION_REQUEST_PRIORITY_ENUM.NORMAL,
			status: PRODUCTION_REQUEST_STATUSES_ENUM.DRAFT,
			description: null as string | null,
			remark: null as string | null,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			productionRequestId: null as number | null,
			salesOrderItemId: null as number | null,
			productId: 0,
			productCode: null as string | null,
			productName: null as string | null,
			unitId: null as number | null,
			requestedQuantity: 0,
			plannedQuantity: 0,
			producedQuantity: 0,
			requiredDate: null as string | null,
			status: PRODUCTION_REQUEST_ITEM_STATUS_ENUM.PENDING,
			sortOrder: 0,
			remark: null as string | null,
		};
	}

	private _validate(): string {
		const requestNo = this.form.requestNo.trim();

		if (!requestNo) {
			return this.i18n.t('productionRequest.err.requestNoRequired');
		}

		if (!this.form.customerId || this.form.customerId <= 0) {
			return this.i18n.t('productionRequest.err.customerIdRequired');
		}

		if (!this.form.requestDate) {
			return this.i18n.t('productionRequest.err.requestDateRequired');
		}
		if (!this.form.requiredDate) {
			return this.i18n.t('productionRequest.err.requiredDateRequired');
		}
		if (!this.form.receiptMaterialDate) {
			return this.i18n.t('productionRequest.err.receiptMaterialDateRequired');
		}

		if (this.form.priority < 1) {
			return this.i18n.t('productionRequest.err.priorityRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.productionRequests().find(
			productionRequest =>
				productionRequest.requestNo.toLowerCase() === requestNo.toLowerCase() &&
				productionRequest.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('productionRequest.err.requestNoTaken', { requestNo })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveOrder(id: number | null): Observable<ProductionRequestDto> {
		const saleOrder = this.saleOrderApi.items().find(x => x.id === this.form.salesOrderId);
		const body: ProductionRequestRequest = {
			requestNo: this.form.requestNo,
			salesOrderId: this.form.salesOrderId ?? null,
			salesOrderNo: saleOrder?.orderNo ?? '',
			customerId: this.form.customerId ?? null,
			requestDate: this.form.requestDate,
			requiredDate: this.form.requiredDate ?? '',
			receiptMaterialDate: this.form.receiptMaterialDate ?? '',
			priority: this.form.priority,
			status: this.form.status,
			description: this.form.description ?? null,
			remark: this.form.remark ?? null,

			productionRequestItems: this.itemRows().map((r, index) => ({
				id: r.id > 0 ? r.id : 0,
				productionRequestId: r.productionRequestId ?? null,
				salesOrderItemId: r.salesOrderItemId ?? null,
				productId: r.productId,
				productCode: r.productCode ?? null,
				productName: r.productName ?? null,
				unitId: r.unitId ?? null,
				requestedQuantity: r.requestedQuantity,
				plannedQuantity: r.plannedQuantity,
				producedQuantity: r.producedQuantity,
				requiredDate: r.requiredDate,
				status: r.status,
				sortOrder: index + 1,
				remark: r.remark ?? null,
			})),

		};

		return id ? this.productionRequestApi.update(id, body) : this.productionRequestApi.create(body);
	}


	private _nextRequestNo(): string {
		let prefix = 'PR';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.productionRequests().filter(r =>
			r.requestNo.startsWith(prefixWithDate),
		);

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.requestNo.match(
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


	private _toLocalInput(value: string | null | undefined): string | null {
		if (!value) return null;
		const date = new Date(value);
		return isNaN(date.getTime()) ? null : formatDate(date, DATETIME_LOCAL, 'en-US');
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
