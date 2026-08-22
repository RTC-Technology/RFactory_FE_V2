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
import { PURCHASE_ORDER_STATUSES, PurchaseOrderDeliveryScheduleDto, PurchaseOrderDeliveryScheduleRequest, PurchaseOrderDetailDto, PurchaseOrderDetailRequest, PurchaseOrderDto } from '../../domain/models/purchase-order.model';
import { productStatusOf } from '../../domain/models/product.model';
import { forkJoin } from 'rxjs';
import { PERMISSIONS } from '../../core/auth/permissions';
import { HttpErrorResponse } from '@angular/common/http';
import { ChevronDownIcon, ChevronRightIcon } from 'primeng/icons';

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

@Component({
	selector: 'app-purchase-order',
	standalone: true,
	imports: [
		CommonModule, FormsModule,
		TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
		InputTextModule, TextareaModule, SelectModule, TagModule, ToggleSwitchModule,
		HasPermissionDirective, PanelModule, CardModule, InputNumberModule, AutoCompleteModule,
		ChevronDownIcon, ChevronRightIcon
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

	readonly schedule = computed(() => {
		const id = this.selectedDetail()?.id;
		if (id == null) return [];
		return this.scheduleApi.items().filter(b => b.purchaseOrderDetailId === id);
	});

	/** Receipts the backend holds with no id. No panel here can reach them. */
	readonly unassignedReceipts = computed(() =>
		this.poApi.items().filter(b => b.id == null).length);

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

		effect(() => {
			const schedules = this.schedule();
			untracked(() => this.selectedSchedule.set(this._reconcile(this.selectedSchedule(), schedules)));
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
			location: this.locationApi.load(),
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
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

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

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), pono: this._nextPoNo() };
		// An issue with no line is meaningless, so start the operator on one.
		this.detailRows.set([this._emptyDetailRow()]);
		this.scheduleRows.set([this._emptySchduleRow()]);
		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPo();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		// this.form = {
		// 	issueNo: row.issueNo ?? '',
		// 	issueType: row.issueType ?? null,
		// 	warehouseId: row.warehouseId ?? 0,
		// 	referenceType: row.referenceType?.trim() ?? '',
		// 	referenceId: row.referenceId ?? null,
		// 	issueDate: this._toLocalInput(row.issueDate),
		// 	status: row.status ?? 1,
		// 	remark: row.remark?.trim() || '',
		// 	// Carried untouched: the backend maps the whole payload onto the entity, so leaving
		// 	// these out of the PUT would blank the approval and posting trail.
		// 	approvedBy: row.approvedBy ?? null,
		// 	approvedDate: row.approvedDate ?? null,
		// 	postedBy: row.postedBy ?? null,
		// 	postedDate: row.postedDate ?? null,
		// };
		// this.detailRows.set(
		// 	this.goodsIssueDetailApi.items()
		// 		.filter(d => d.goodsIssueId === row.id)
		// 		.map(d => ({ ...d })));


		this.dialogOpen.set(true);
	}

	askDelete(): void {
		const row = this.selectedPo();
		if (!row) return;

		// this.confirm.confirm({
		// this.confirm.confirm({
		//     header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('goodsIssue.lower') }),
		//     message: `${this.i18n.t('plant.confirm.message', { label: row.issueNo })} ${this.i18n.t('common.notUndoable')}`,
		//     acceptLabel: this.i18n.t('common.delete'),
		//     rejectLabel: this.i18n.t('common.cancel'),
		//     acceptButtonStyleClass: 'p-button-danger',
		//     rejectButtonStyleClass: 'p-button-text',
		//     // The backend owns the "still used by products" rule and returns its own message.
		//     accept: () => this.goodsIssueApi.remove(row.id).subscribe({
		//         next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.issueNo })); },
		//         error: (err: HttpErrorResponse) =>
		//             this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('goodsIssue.lower') }), err),
		//     }),
		// });
	}

	askApprove(isApprove: boolean): void {
		const row = this.selectedPo();
		if (!row) return;

		const headerKey = isApprove ? 'plant.confirm.approve.title' : 'plant.confirm.unapprove.title';
		const messageKey = isApprove ? 'plant.confirm.approve.message' : 'plant.confirm.unapprove.message';
		const acceptLabelKey = isApprove ? 'common.approve' : 'common.unapprove';

		// this.confirm.confirm({
		// 	header: this.i18n.t(headerKey, { entity: this.i18n.t('goodsIssue.lower') }),
		// 	message: `${this.i18n.t(messageKey, { label: row.issueNo })}`,
		// 	acceptLabel: this.i18n.t(acceptLabelKey),
		// 	rejectLabel: this.i18n.t('common.cancel'),
		// 	acceptButtonStyleClass: isApprove ? 'p-button-success' : 'p-button-danger',
		// 	rejectButtonStyleClass: 'p-button-text',
		// 	// The backend owns the "still used by products" rule and returns its own message.
		// 	accept: () => this._approveIssue(row.id, isApprove).subscribe({
		// 		next: () => {
		// 			this.saving.set(false);
		// 			this.dialogOpen.set(false);
		// 			this.reload();
		// 			this._ok(this.i18n.t(isApprove ? 'plant.ok.approved' : 'plant.ok.unapproved', {
		// 				label: row.issueNo
		// 			}));
		// 		},
		// 		error: (err: HttpErrorResponse) => {
		// 			this.saving.set(false);
		// 			this.formError.set(err.error?.message
		// 				|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('goodsIssue.lower') }));
		// 		},
		// 	}),
		// });
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
		};
	}

	private _emptyDetailRow(): PurchaseOrderDetailDto {
		return {
			id: --this._tempDetailId,
			purchaseOrderId: 0,
			productId: 0,
			unitId: 0,
			quantity: 0,
			unitPrice: null as number | null,
		};
	}

	private _emptySchduleRow(): PurchaseOrderDeliveryScheduleDto {
		return {
			id: --this._tempDetailId,
			purchaseOrderDetailId: 0,
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


	// private _validate(): string {
	//     const issueNo = this.form.issueNo.trim();

	//     if (!issueNo) {
	//         return this.i18n.t('goodsIssue.err.issueNoRequired');
	//     }

	//     if (!this.form.issueDate) {
	//         return this.i18n.t('goodsIssue.err.issueDateRequired');
	//     }

	//     if (!this.form.status) {
	//         return this.i18n.t('goodsIssue.err.statusRequired');
	//     }

	//     // IssueNo is unique across the entire goods issue list.
	//     const clash = this.goodsIssueApi.items().find(
	//         issue =>
	//             issue.issueNo.toLowerCase() === issueNo.toLowerCase() &&
	//             issue.id !== this.editingId(),
	//     );

	//     return clash
	//         ? this.i18n.t('goodsIssue.err.issueNoTaken', { issueNo })
	//         : '';
	// }

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */
	// private _validateDetails(): string {
	//     const rows = this.detailRows();
	//     if (rows.length === 0) return this.i18n.t('goodsIssueDetail.err.linesRequired');

	//     for (let i = 0; i < rows.length; i++) {
	//         const row = rows[i];
	//         const line = i + 1;

	//         if (!row.productId) return this.i18n.t('goodsIssueDetail.err.productRequired', { line });
	//         if (!row.unitId) return this.i18n.t('goodsIssueDetail.err.unitRequired', { line });
	//         if (!row.locationId) return this.i18n.t('goodsIssueDetail.err.locationRequired', { line });
	//         if (!row.serialNo) return this.i18n.t('goodsIssueDetail.err.serialNoRequired', { line });
	//         if (!row.quantity || row.quantity <= 0) return this.i18n.t('goodsIssueDetail.err.quantityRequired', { line });

	//     }

	//     return '';
	// }

	// private _savePo(id: number | null): Observable<GoodsIssueDto> {
	//     const body: GoodsIssueRequest = {
	//         issueNo: this.form.issueNo.trim(),
	//         issueType: this.form.issueType ?? 1,
	//         warehouseId: this.form.warehouseId,
	//         referenceType: this.form.referenceType?.trim() || null,
	//         referenceId: this.form.referenceId,
	//         issueDate: this.form.issueDate,
	//         status: this.form.status ?? 1,
	//         remark: this.form.remark?.trim() || null,
	//         approvedBy: this.form.approvedBy,
	//         approvedDate: this.form.approvedDate,
	//         postedBy: this.form.postedBy,
	//         postedDate: this.form.postedDate,
	//         // The whole line set every time: the backend replaces what it holds, which is how a
	//         // line the operator removed from the grid gets deleted.
	//         goodsIssueDetails: this.detailRows().map(row => ({
	//             // Drafts carry a negative id so the grid can key them; the server reads 0 as "new".
	//             id: row.id > 0 ? row.id : 0,
	//             goodsIssueId: row.goodsIssueId ?? 0,
	//             productId: row.productId,
	//             unitId: row.unitId,
	//             locationId: row.locationId ?? null,
	//             lotNo: row.lotNo?.trim() || null,
	//             serialNo: row.serialNo?.trim() || null,
	//             quantity: row.quantity ?? null,
	//             unitPrice: row.unitPrice ?? null,
	//             remark: row.remark?.trim() || null,
	//         })),
	//     };
	//     return id ? this.goodsIssueApi.update(id, body) : this.goodsIssueApi.create(body);
	// }

	// private _approveIssue(id: number | null, isApprove: boolean): Observable<GoodsIssueDto> {
	//     if (id == null) {
	//         return throwError(() => new Error(this.i18n.t('goodsIssue.err.notFound')));
	//     }

	//     const issue = this.goodsIssueApi.items().find(r => r.id === id);
	//     if (!issue) {
	//         return throwError(() => new Error(this.i18n.t('goodsIssue.err.notFound')));
	//     }

	//     const body: GoodsIssueRequest = {
	//         issueNo: issue.issueNo,
	//         warehouseId: issue.warehouseId,
	//         referenceType: issue.referenceType ?? null,
	//         referenceId: issue.referenceId,
	//         issueDate: issue.issueDate,
	//         remark: issue.remark ?? null,

	//         approvedBy: issue.approvedBy,
	//         approvedDate: isApprove
	//             ? formatDate(new Date(), DATETIME_LOCAL, 'en-US')
	//             : null,

	//         postedBy: issue.postedBy,
	//         postedDate: issue.postedDate,

	//         issueType: issue.issueType ?? 1,
	//         status: issue.status ?? 1,
	//     };

	//     return this.goodsIssueApi.update(id, body);
	// }

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
