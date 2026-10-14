import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
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
import { I18nService } from '../../core/services/i18n.service';
import { UnitApiService, ProductApiService } from '../../core/services/product-api.service';
import { SaleOrderApiService, SaleOrderItemApiService, SaleOrderPaymentScheduleApiService } from '../../core/services/production-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { CurrencyApiService, CustomerApiService } from '../../core/services/master-data-api.service';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { SALES_ORDER_EXECUTION_STATUSES, SALES_ORDER_PAYMENT_SCHEDULE_STATUSES, SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM, SALES_ORDER_REVENUE_STATUSES, SALES_ORDER_STATUSES, SALES_ORDER_TYPES, SalesOrderDto, SalesOrderItemDto, SalesOrderPaymentScheduleDto, SalesOrderRequest } from '../../domain/models/production.model';
import { productStatusOf } from '../../domain/models/product.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'salesOrder' | 'salesOrderItem' | 'salesOrderPaymentSchedule';
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
	selector: 'app-sales-order',
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
		ToggleButtonModule
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './sales-order.component.html',
	styleUrl: './sales-order.component.scss',
})
export class SalesOrderComponent extends PermissionAwarePage implements OnInit {
	private readonly saleOrderApi = inject(SaleOrderApiService);
	private readonly saleOrderItemApi = inject(SaleOrderItemApiService);
	private readonly saleOrderPaymentScheduleApi = inject(SaleOrderPaymentScheduleApiService);

	private readonly customerApi = inject(CustomerApiService);
	private readonly currencyApi = inject(CurrencyApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly warehouseApi = inject(WarehouseApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────

	customerLabel(id?: number | null): string {
		if (id == null) return '';
		const customer = this.customerApi.items().find(u => u.id === id);
		return customer ? `${customer.customerCode} · ${customer.customerName}` : '';
	}

	currencyLabel(id?: number | null): string {
		if (id == null) return '';
		const currency = this.currencyApi.items().find(u => u.id === id);
		return currency ? `${currency.currencyCode}` : '';
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

	warehouseLabel(id?: number | null): string {
		if (id == null) return '';
		const warehouse = this.warehouseApi.items().find(u => u.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	typeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = SALES_ORDER_TYPES.find(u => u.value === id);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = SALES_ORDER_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	executionStatusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = SALES_ORDER_EXECUTION_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	revenueStatusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = SALES_ORDER_REVENUE_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	scheduleStatusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	readonly customerOptions = computed(() =>
		this.customerApi.items().map(u => ({ label: `${u.customerCode} · ${u.customerName}`, value: u.id })));

	readonly saleOrderOptions = computed(() =>
		this.saleOrderApi.items()
			.filter(u => u.id !== this.selectedOrder()?.id)
			.map(u => ({ label: `${u.orderNo} · ${u.orderDate ? formatDate(u.orderDate, DATETIME_LOCAL, 'en-US') : ''}`, value: u.id })));

	readonly currencyOptions = computed(() =>
		this.currencyApi.items().map(u => ({ label: `${u.currencyCode} · ${u.currencyName}`, value: u.id })));

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

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(u => ({ label: `${u.warehouseCode} · ${u.warehouseName}`, value: u.id })));

	readonly typeOptions = computed(() =>
		SALES_ORDER_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		SALES_ORDER_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly executionStatusOptions = computed(() =>
		SALES_ORDER_EXECUTION_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly revenueStatusOptions = computed(() =>
		SALES_ORDER_REVENUE_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly scheduleStatusOptions = computed(() =>
		SALES_ORDER_PAYMENT_SCHEDULE_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedOrder = signal<SalesOrderDto | null>(null);
	readonly selectedItem = signal<SalesOrderItemDto | null>(null);
	readonly selectedSchedule = signal<SalesOrderPaymentScheduleDto | null>(null);

	readonly saleOrders = computed(() => {
		const all = this.saleOrderApi.items();
		return all;
	});

	readonly orderItems = computed(() => {
		const id = this.selectedOrder()?.id;
		if (id == null) return [];
		return this.saleOrderItemApi.items().filter(e => e.salesOrderId === id);
	});

	readonly schedules = computed(() => {
		const id = this.selectedOrder()?.id;
		if (id == null) return [];
		return this.saleOrderPaymentScheduleApi.items().filter(e => e.salesOrderId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly orderTable = viewChild<Table>('orderTable');
	private readonly orderItemTable = viewChild<Table>('orderItemTable');
	private readonly orderScheduleTable = viewChild<Table>('orderScheduleTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		salesOrder: [''],
		salesOrderItem: [''],
		salesOrderPaymentSchedule: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			salesOrder: this.orderTable(),
			salesOrderItem: this.orderItemTable(),
			salesOrderPaymentSchedule: this.orderScheduleTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'salesOrder') {
			this.selectedOrder.set(this._reconcile(this.selectedOrder(), visible as SalesOrderDto[]));
		} else if (kind === 'salesOrderItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as SalesOrderItemDto[]));
		} else if (kind === 'salesOrderPaymentSchedule') {
			this.selectedSchedule.set(this._reconcile(this.selectedSchedule(), visible as SalesOrderPaymentScheduleDto[]));
		}
	}

	selectOrder(order: SalesOrderDto): void {
		if (this.selectedOrder()?.id === order.id) return;
		this.selectedOrder.set(order);
	}

	selectItem(item: SalesOrderItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}

	selectSchedule(schedule: SalesOrderPaymentScheduleDto): void {
		if (this.selectedSchedule()?.id === schedule.id) return;
		this.selectedSchedule.set(schedule);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.salesOrder);

		effect(() => {
			const orders = this.saleOrders();
			untracked(() => this.selectedOrder.set(this._reconcile(this.selectedOrder(), orders)));
		});

		effect(() => {
			const items = this.orderItems();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});

		effect(() => {
			const schedules = this.schedules();
			untracked(() => this.selectedSchedule.set(this._reconcile(this.selectedSchedule(), schedules)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			salesOrders: this.saleOrderApi.load(),
			salesOrderItems: this.saleOrderItemApi.load(),
			salesOrderPaymentSchedules: this.saleOrderPaymentScheduleApi.load(),

			customers: this.customerApi.load(),
			currencies: this.currencyApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
			warehouses: this.warehouseApi.load(),

		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('salesOrder.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly itemRows = signal<SalesOrderItemDto[]>([]);
	readonly scheduleRows = signal<SalesOrderPaymentScheduleDto[]>([]);

	private _tempItemId = 0;
	private _tempScheduleId = 0;

	activeTab = 'item';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('salesOrder.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = {
			...this._emptyForm(),
		};

		this.onCalculatePaymentDueDate();
		this.itemRows.set([this._emptyItemRow()]);
		this.scheduleRows.set([this._emptyScheduleRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedOrder();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			orderNo: row.orderNo,
			customerId: row.customerId,
			parentId: row.parentId ?? 0,
			orderDate: this._toLocalInput(row.orderDate) ?? formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			expectedDeliveryDate: this._toLocalInput(row.expectedDeliveryDate) ?? null,
			orderType: row.orderType,
			status: row.status,
			executionStatus: row.executionStatus,
			revenueStatus: row.revenueStatus,
			currencyId: row.currencyId ?? null,
			exchangeRate: row.exchangeRate,
			totalAmount: row.totalAmount,
			discountAmount: row.discountAmount,
			paidAmount: row.paidAmount,
			outstandingAmount: row.outstandingAmount,
			paymentTermDays: row.paymentTermDays ?? null,
			paymentDueDate: this._toLocalInput(row.paymentDueDate) ?? null,
			opportunityId: row.opportunityId ?? null,
			campaignId: row.campaignId ?? null,
			quotationId: row.quotationId ?? null,
			description: row.description ?? null,

		};

		this.itemRows.set(
			this.saleOrderItemApi.items()
				.filter(d => d.salesOrderId === row.id)
				.map(d => ({
					...d,
					expectedDeliveryDate: this._toLocalInput(d.expectedDeliveryDate) ?? null,
				})));

		this.scheduleRows.set(
			this.saleOrderPaymentScheduleApi.items()
				.filter(d => d.salesOrderId === row.id)
				.map(d => ({
					...d,
					dueDate: this._toLocalInput(d.dueDate) ?? null,
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
					entity: this.i18n.t('salesOrder.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('salesOrder.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedOrder();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('salesOrder.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.orderNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.saleOrderApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.orderNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('salesOrder.lower') }), err),
			}),
		});
	}

	onCustomerChange(customerId: number | null): void {
		if (this.form.orderNo) return;
		this.form.orderNo = this._nextOrderNo(customerId);
	}

	onTotalAmountChange(totalAmount: number | null): void {
		if (totalAmount === null) return;
		this.form.outstandingAmount = totalAmount - this.form.paidAmount;
	}

	onCalculatePaymentDueDate(): void {
		if (this.form.paymentTermDays == null || this.form.orderDate == null) return;

		const orderDate = new Date(this.form.orderDate);
		const paymentDueDate = orderDate.setDate(orderDate.getDate() + this.form.paymentTermDays);
		this.form.paymentDueDate = formatDate(new Date(paymentDueDate), DATETIME_LOCAL, 'en-US');
	}

	updateOrderTotalAmount(): void {
		this.form.totalAmount = this.orderTotalAmount();
	}

	updateOrderDiscountAmount(): void {
		this.form.discountAmount = this.orderTotalDiscountAmount();
	}

	updateOrderPaidAmount(): void {
		this.form.paidAmount = this.scheduleTotalPaidAmount();
	}

	updateOrderOutstandingAmount(): void {
		this.form.outstandingAmount = this.orderTotalAmount() - this.form.paidAmount;
	}

	// ─── item grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
		this.updateOrderTotalAmount();
		this.updateOrderDiscountAmount();
		this.updateOrderOutstandingAmount();
	}

	removeItemRow(row: SalesOrderItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}

	onProductChange(productId: number | null, row: SalesOrderItemDto): void {
		const product = this.productApi.items().find(m => m.id === productId);

		row.productName = product?.productName ?? row.productName;
		row.unitId = product?.defaultUnitId ?? row.unitId;
		row.unitPrice = product?.fixedPurchasePrice ?? row.unitPrice;
	}

	onCalculateAmount(row: SalesOrderItemDto): void {
		row.amount = row.orderedQuantity * row.unitPrice;
		row.discountAmount = row.amount * (row.discountPercent / 100);

		let taxableAmount = row.amount - row.discountAmount;
		row.taxAmount = taxableAmount * (row.taxPercent / 100);
		row.totalAmount = taxableAmount + row.taxAmount;

		this.updateOrderTotalAmount();
		this.updateOrderDiscountAmount();
		this.updateOrderOutstandingAmount();
	}

	orderOrderedQuantity(): number {
		return this.itemRows().reduce((sum, row) => sum + (row.orderedQuantity ?? 0), 0);
	}
	orderAmount(): number {
		return this.itemRows().reduce((sum, row) => sum + (row.amount ?? 0), 0);
	}
	orderTotalDiscountAmount(): number {
		return this.itemRows().reduce((sum, row) => sum + (row.discountAmount ?? 0), 0);
	}
	orderTotalTaxAmount(): number {
		return this.itemRows().reduce((sum, row) => sum + (row.taxAmount ?? 0), 0);
	}
	orderTotalAmount(): number {
		return this.itemRows().reduce((sum, row) => sum + (row.totalAmount ?? 0), 0);
	}

	// ─── product grid ────────────────────────────────────────────────────────────
	addScheduleRow(): void {
		this.scheduleRows.update(rows => [...rows, this._emptyScheduleRow()]);
	}

	removeScheduleRow(row: SalesOrderPaymentScheduleDto): void {
		this.scheduleRows.update(rows => rows.filter(r => r !== row));
	}

	onCalculatePaymentAmount(row: SalesOrderPaymentScheduleDto): void {
		row.paymentAmount = this.form.totalAmount * (row.paymentPercent / 100);
		this.onUpdateStatusPayment(row);
	}
	onChangePaymentDueDate(row: SalesOrderPaymentScheduleDto): void {
		this.onUpdateStatusPayment(row);
	}

	onCalculatePaidAmount(row: SalesOrderPaymentScheduleDto): void {
		this.onUpdateStatusPayment(row);
		this.updateOrderPaidAmount();
		this.updateOrderOutstandingAmount();
	}

	scheduleTotalPaymentPercent(): number {
		return this.scheduleRows().reduce((sum, row) => sum + (row.paymentPercent ?? 0), 0);
	}

	scheduleTotalPaymentAmount(): number {
		return this.scheduleRows().reduce((sum, row) => sum + (row.paymentAmount ?? 0), 0);
	}

	scheduleTotalPaidAmount(): number {
		return this.scheduleRows().reduce((sum, row) => sum + (row.paidAmount ?? 0), 0);
	}

	onUpdateStatusPayment(row: SalesOrderPaymentScheduleDto) {

		if (row.paidAmount == null || row.paidAmount == 0) row.status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM.PENDING;
		else if (row.paidAmount < row.paymentAmount) row.status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM.PARTIALLY_PAID;
		else row.status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM.PAID;

		if (row.dueDate && !row.paidAmount) {
			const dateNow = new Date(formatDate(new Date(), DATETIME_LOCAL, 'en-US'));
			const dueDate = new Date(formatDate(row.dueDate, DATETIME_LOCAL, 'en-US'));

			if (dateNow.getTime() === dueDate.getTime()) row.status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM.DUE;
			else if (dateNow.getTime() > dueDate.getTime()) row.status = SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM.OVERDUE;
		}
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			orderNo: '',
			customerId: 0,
			parentId: null as number | null,
			orderDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			expectedDeliveryDate: null as string | null,
			orderType: 1,
			status: 1,
			executionStatus: 1,
			revenueStatus: 1,
			currencyId: null as number | null,
			exchangeRate: 1,
			totalAmount: 0,
			discountAmount: 0,
			paidAmount: 0,
			outstandingAmount: 0,
			paymentTermDays: 0 as number | null,
			paymentDueDate: null as string | null,
			opportunityId: null as number | null,
			campaignId: null as number | null,
			quotationId: null as number | null,
			description: null as string | null,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			salesOrderId: null as number | null,
			productId: 0,
			productName: '',
			unitId: null as number | null,
			warehouseId: null as number | null,
			orderedQuantity: 0,
			deliveredQuantity: 0 as number | null,
			cancelledQuantity: 0 as number | null,
			unitPrice: 0,
			amount: 0,
			discountPercent: 0,
			discountAmount: 0,
			taxPercent: 0,
			taxAmount: 0,
			totalAmount: 0,
			expectedDeliveryDate: null as string | null,
			description: null as string | null,
		};
	}

	private _emptyScheduleRow() {
		return {
			id: this._tempScheduleId--,
			salesOrderId: null as number | null,
			scheduleNo: 0,
			scheduleName: '',
			paymentPercent: 0,
			paymentAmount: 0,
			dueDate: null as string | null,
			paidAmount: 0 as number | null,
			status: 1,
			description: null as string | null,
		};
	}


	private _validate(): string {
		const orderNo = this.form.orderNo.trim();

		if (!orderNo) {
			return this.i18n.t('salesOrder.err.orderNoRequired');
		}

		if (!this.form.customerId || this.form.customerId <= 0) {
			return this.i18n.t('salesOrder.err.customerIdRequired');
		}

		if (!this.form.orderDate) {
			return this.i18n.t('salesOrder.err.orderDateRequired');
		}

		if (this.form.paymentTermDays == null || this.form.paymentTermDays < 0) {
			return this.i18n.t('salesOrder.err.paymentTermDaysRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.saleOrders().find(
			salesOrder =>
				salesOrder.orderNo.toLowerCase() === orderNo.toLowerCase() &&
				salesOrder.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('salesOrder.err.orderNoTaken', { orderNo })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveOrder(id: number | null): Observable<SalesOrderDto> {
		const body: SalesOrderRequest = {
			orderNo: this.form.orderNo,
			customerId: this.form.customerId,
			parentId: this.form.parentId ?? 0,
			orderDate: this.form.orderDate,
			expectedDeliveryDate: this.form.expectedDeliveryDate || null,
			orderType: this.form.orderType,
			status: this.form.status,
			executionStatus: this.form.executionStatus,
			revenueStatus: this.form.revenueStatus,
			currencyId: this.form.currencyId ?? null,
			exchangeRate: this.form.exchangeRate,
			totalAmount: this.form.totalAmount,
			discountAmount: this.form.discountAmount,
			paidAmount: this.form.paidAmount,
			outstandingAmount: this.form.outstandingAmount,
			paymentTermDays: this.form.paymentTermDays ?? null,
			paymentDueDate: this.form.paymentDueDate || null,
			opportunityId: this.form.opportunityId ?? null,
			campaignId: this.form.campaignId ?? null,
			quotationId: this.form.quotationId ?? null,
			description: this.form.description ?? null,

			salesOrderItems: this.itemRows().map(r => ({
				id: r.id > 0 ? r.id : 0,
				salesOrderId: r.salesOrderId ?? null,
				productId: r.productId,
				productName: r.productName,
				unitId: r.unitId ?? null,
				warehouseId: r.warehouseId ?? null,
				orderedQuantity: r.orderedQuantity,
				deliveredQuantity: r.deliveredQuantity ?? null,
				cancelledQuantity: r.cancelledQuantity ?? null,
				unitPrice: r.unitPrice,
				amount: r.amount,
				discountPercent: r.discountPercent,
				discountAmount: r.discountAmount,
				taxPercent: r.taxPercent,
				taxAmount: r.taxAmount,
				totalAmount: r.totalAmount,
				expectedDeliveryDate: r.expectedDeliveryDate || null,
				description: r.description || null,
			})),

			salesOrderPaymentSchedules: this.scheduleRows().map((r, i) => ({
				id: r.id > 0 ? r.id : 0,
				salesOrderId: r.salesOrderId ?? null,
				scheduleNo: i + 1,
				scheduleName: r.scheduleName,
				paymentPercent: r.paymentPercent,
				paymentAmount: r.paymentAmount,
				dueDate: r.dueDate || null,
				paidAmount: r.paidAmount ?? null,
				status: r.status,
				description: r.description ?? null,
			})),
		};

		// console.log('productRows:', this.productRows());
		// console.log('productOptions:', this.productOptions());
		return id ? this.saleOrderApi.update(id, body) : this.saleOrderApi.create(body);
	}


	private _nextOrderNo(customerId: number | null): string {

		const customer = this.customerApi.items().find(x => x.id === customerId);

		let prefix = 'SO';
		if (customer) prefix = `SO_${customer.customerCode}`;

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.saleOrders().filter(r =>
			r.orderNo.startsWith(prefixWithDate),
		);

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.orderNo.match(
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
