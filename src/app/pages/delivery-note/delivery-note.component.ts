import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DeliveryNoteApiService, DeliveryNoteItemApiService, DeliveryNoteReceiverApiService, DeliveryNoteSenderApiService, DeliveryNoteSourceApiService } from '../../core/services/delivery-note-api.service';
import { GoodsIssueApiService, GoodsIssueDetailApiService } from '../../core/services/goods-issue-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { UserApiService } from '../../core/services/organization-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { DELIVERY_NOTE_STATUSES, DELIVERY_NOTE_TRANSPORT_METHODS, DELIVERY_NOTE_VEHICLE_TYPES, DeliveryNoteDto, DeliveryNoteItemDto, DeliveryNoteReceiverDto, DeliveryNoteRequest, DeliveryNoteSenderDto, DeliveryNoteSourceDto } from '../../domain/models/delivery-note.model';
import { GOODS_ISSUE_STATUSES } from '../../domain/models/goods-issue.model';
import { productStatusOf } from '../../domain/models/product.model';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';

type EntityKind = 'deliveryNote' | 'deliveryNoteSources' | 'deliveryNoteItem';

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

interface DeliveryNoteSourceOption {
	value: number;
	label: string;

	sourceNo: string;
	sourceDate: string;
	statusLabel: string;
}

interface DeliveryNoteSourceDetailOption {
	value: number;
	label: string;

	productId: number;
	// productCode: string;
	// productName: string;
	unitId: number;
	// unitName: string;
	// lotNo: string;
	serialNo: string;
	quantity: number;
}

@Component({
	selector: 'app-delivery-note',
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
		CheckboxModule,
		TabsModule,
		HasPermissionDirective,
		SplitterModule,
		Textarea,
		InputGroupModule,
		InputGroupAddonModule,
		ColorPickerModule,
		PanelModule,
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './delivery-note.component.html',
	styleUrl: './delivery-note.component.scss',
})
export class DeliveryNoteComponent extends PermissionAwarePage implements OnInit {
	private readonly deliveryNoteApi = inject(DeliveryNoteApiService);
	private readonly deliveryNoteItemApi = inject(DeliveryNoteItemApiService);
	private readonly deliveryNoteSourceApi = inject(DeliveryNoteSourceApiService);
	private readonly deliveryNoteSenderApi = inject(DeliveryNoteSenderApiService);
	private readonly deliveryNoteReceiverApi = inject(DeliveryNoteReceiverApiService);

	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly userApi = inject(UserApiService);
	private readonly goodsIssueApi = inject(GoodsIssueApiService);
	private readonly goodsIssueDetailApi = inject(GoodsIssueDetailApiService);


	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────

	warehouseLabel(id?: number | null): string {
		if (id == null) return '';
		const warehouse = this.warehouseApi.items().find(w => w.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(p => p.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	unitLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? (unit.symbol || unit.unitCode) : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	goodsIssueLabel(id?: number | null): string {
		if (id == null) return '';
		const goodsIssue = this.goodsIssueApi.items().find(u => u.id === id);
		return goodsIssue ? `${goodsIssue.issueNo}` : '';
	}

	statusLabel(status?: number | null): string {
		if (status == null) return '';
		const statusType = DELIVERY_NOTE_STATUSES.find(s => s.value === status);
		return statusType ? this.i18n.t(statusType.labelKey) : '';
	}

	vehicleTypeLabel(vehicleType?: number | null): string {
		if (vehicleType == null) return '';
		const vehicleTypeType = DELIVERY_NOTE_VEHICLE_TYPES.find(s => s.value === vehicleType);
		return vehicleTypeType ? this.i18n.t(vehicleTypeType.labelKey) : '';
	}

	transportMethodLabel(transportMethod?: number | null): string {
		if (transportMethod == null) return '';
		const transportMethodType = DELIVERY_NOTE_TRANSPORT_METHODS.find(s => s.value === transportMethod);
		return transportMethodType ? this.i18n.t(transportMethodType.labelKey) : '';
	}


	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(u => ({ label: `${u.warehouseCode} · ${u.warehouseName}`, value: u.id })));

	readonly statusOptions = computed(() =>
		DELIVERY_NOTE_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly goodIssueStatusOptions = computed(() =>
		GOODS_ISSUE_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly vehicleTypeOptions = computed(() =>
		DELIVERY_NOTE_VEHICLE_TYPES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly transportMethodOptions = computed(() =>
		DELIVERY_NOTE_TRANSPORT_METHODS.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly goodsIssueOptions = computed<DeliveryNoteSourceOption[]>(() => {
		return this.goodsIssueApi.items()
			// .filter(x => x.issueType == sourceType || sourceType == 0)
			.map(p => {
				const type = GOODS_ISSUE_STATUSES.find(s => s.value === p.issueType);
				return {
					value: p.id,
					label: p.issueNo,
					sourceNo: p.issueNo,
					sourceDate: p.issueDate || '',
					statusLabel: this.i18n.t(type?.labelKey || ''),
				};
			});
	});

	readonly goodsIssueDetailOptions = (goodsIssueId: number | null): DeliveryNoteSourceDetailOption[] => {
		return this.goodsIssueDetailApi.items()
			.filter(x => x.goodsIssueId == goodsIssueId)
			.map(p => {
				// const product = this.productApi.items().find(x => x.id == p.productId);
				// const unit = this.unitApi.items().find(x => x.id == p.unitId);
				return {
					value: p.id,
					label: this.productLabel(p.productId),
					productId: p.productId,
					// productCode: this.productCode(p.productId),
					// productName: this.productName(p.productId),
					unitId: p.unitId,
					// unitName: this.unitLabel(p.unitId),
					// lotNo: p.lotNo || '',
					serialNo: p.serialNo || '',
					quantity: p.quantity || 0,
				};
			});
	};


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

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedDelivery = signal<DeliveryNoteDto | null>(null);
	readonly selectedDeliveryItem = signal<DeliveryNoteItemDto | null>(null);
	readonly selectedDeliverySource = signal<DeliveryNoteSourceDto | null>(null);

	readonly deliveries = computed(() => {
		const all = this.deliveryNoteApi.items();
		return all;
	});

	readonly deliveryItems = computed(() => {
		const id = this.selectedDelivery()?.id;
		if (id == null) return [];
		return this.deliveryNoteItemApi.items().filter(b => b.deliveryNoteId === id);
	});

	readonly deliverySources = computed(() => {
		const id = this.selectedDelivery()?.id;
		if (id == null) return [];
		return this.deliveryNoteSourceApi.items().filter(b => b.deliveryNoteId === id);
	});


	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly deliveryNoteTable = viewChild<Table>('deliveryNoteTable');
	private readonly deliveryNoteSourcesTable = viewChild<Table>('deliveryNoteSourcesTable');
	private readonly deliveryNoteItemTable = viewChild<Table>('deliveryNoteItemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		deliveryNote: [''],
		deliveryNoteSources: [''],
		deliveryNoteItem: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			deliveryNote: this.deliveryNoteTable(),
			deliveryNoteSources: this.deliveryNoteSourcesTable(),
			deliveryNoteItem: this.deliveryNoteItemTable(),
			// pickingTicket: this.pickingTicketTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'deliveryNote') {
			this.selectedDelivery.set(this._reconcile(this.selectedDelivery(), visible as DeliveryNoteDto[]));
		}
	}

	selectDelivery(deliveryNote: DeliveryNoteDto): void {
		if (this.selectedDelivery()?.id === deliveryNote.id) return;
		this.selectedDelivery.set(deliveryNote);
	}

	selectDeliverySource(source: DeliveryNoteSourceDto): void {
		if (this.selectedDeliverySource()?.id === source.id) return;
		this.selectedDeliverySource.set(source);
	}

	selectDeliveryItem(item: DeliveryNoteItemDto): void {
		if (this.selectedDeliveryItem()?.id === item.id) return;
		this.selectedDeliveryItem.set(item);
	}



	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super();

		effect(() => {
			const deliveries = this.deliveries();
			untracked(() => this.selectedDelivery.set(this._reconcile(this.selectedDelivery(), deliveries)));
		});

		effect(() => {
			const sources = this.deliverySources();
			untracked(() => this.selectedDeliverySource.set(this._reconcile(this.selectedDeliverySource(), sources)));
		});

		effect(() => {
			const items = this.deliveryItems();
			untracked(() => this.selectedDeliveryItem.set(this._reconcile(this.selectedDeliveryItem(), items)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			deliverys: this.deliveryNoteApi.load(),
			deliveryItems: this.deliveryNoteItemApi.load(),
			deliverySenders: this.deliveryNoteSenderApi.load(),
			deliveryReceivers: this.deliveryNoteReceiverApi.load(),
			deliverySources: this.deliveryNoteSourceApi.load(),

			warehouses: this.warehouseApi.load(),
			users: this.userApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
			goodsIssues: this.goodsIssueApi.load(),
			goodsIssueDetails: this.goodsIssueDetailApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('deliveryNote.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	// readonly formSender = signal<DeliveryNoteSenderDto>({ id: 0 });
	// readonly formReceiver = signal<DeliveryNoteReceiverDto>({ id: 0 });
	readonly formSource = signal<DeliveryNoteSourceDto[]>([]);
	readonly formItem = signal<DeliveryNoteItemDto[]>([]);

	activeTab = 'delivery';
	activeLineTab = 'source';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('deliveryNote.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), deliveryNo: this._nextDeliveryNo() };
		// A receipt with no line is meaningless, so start the operator on one.
		// this.formSender.set(this._emptySender());
		// this.formReceiver.set(this._emptyReceiver());
		this.formSource.set([this._emptySource()]);
		this.formItem.set([this._emptyItem()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedDelivery();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		const sender = this.deliveryNoteSenderApi.items().find(s => s.deliveryNoteId === row.id);
		const receiver = this.deliveryNoteReceiverApi.items().find(r => r.deliveryNoteId === row.id);

		this.form = {
			deliveryNo: row.deliveryNo,
			warehouseId: row.warehouseId ?? null,
			status: row.status,
			vehicleNo: row.vehicleNo ?? null,
			vehicleType: row.vehicleType ?? null,
			transportMethod: row.transportMethod ?? null,
			driverName: row.driverName ?? null,
			driverPhone: row.driverPhone ?? null,
			weight: row.weight ?? null,
			volume: row.volume ?? null,
			startedAt: row.startedAt ?? null,
			completedAt: row.completedAt ?? null,
			pickerId: row.pickerId ?? null,
			remark: row.remark ?? null,
			deliveryNoteSender: {
				id: sender?.id ?? 0,
				senderName: sender?.senderName ?? null,
				email1: sender?.email1 ?? null,
				email2: sender?.email2 ?? null,
				phone1: sender?.phone1 ?? null,
				phone2: sender?.phone2 ?? null,
				address1: sender?.address1 ?? null,
				address2: sender?.address2 ?? null,
			},
			deliveryNoteReceiver: {
				id: receiver?.id ?? 0,
				receiverName: receiver?.receiverName ?? null,
				contactName: receiver?.contactName ?? null,
				email1: receiver?.email1 ?? null,
				email2: receiver?.email2 ?? null,
				phone1: receiver?.phone1 ?? null,
				phone2: receiver?.phone2 ?? null,
				address1: receiver?.address1 ?? null,
				address2: receiver?.address2 ?? null,
			},
		};

		this.formSource.set(
			this.deliveryNoteSourceApi.items()
				.filter(source => source.deliveryNoteId === row.id)
				.map(s => {
					const goodsIssue = this.goodsIssueApi.items().find(g => g.id === s.goodsIssueId);
					return {
						...s,
						issueDate: goodsIssue?.issueDate ?? null,
						status: goodsIssue?.status ?? null
					};
				})
		);

		this.formItem.set(
			this.deliveryNoteItemApi.items()
				.filter(item => item.deliveryNoteId === row.id)
		);

		this.dialogOpen.set(true);
	}

	save(): void {
		// const error = this._validate();
		// if (error) {
		// 	this.formError.set(error);
		// 	return;
		// }

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		// One call carrying the header and every line: the backend writes them in a single
		// transaction, so a rejected line cannot leave a receipt behind.
		this._saveDelivery(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('pickingPlan.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('pickingPlan.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedDelivery();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('deliveryNote.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.deliveryNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.deliveryNoteApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.deliveryNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('deliveryNote.lower') }), err),
			}),
		});
	}

	// ─── source grid ──────────────────────────────────────────────────────────────
	addSource(): void {
		this.formSource.update(rows => [...rows, this._emptySource()]);
	}

	removeSource(row: DeliveryNoteSourceDto): void {
		this.formSource.update(rows => rows.filter(r => r !== row));
	}

	onGoodsIssueChange(row: DeliveryNoteSourceDto, id: number | null): void {
		const goodsIssue = this.goodsIssueApi.items().find(p => p.id === id);

		row.issueDate = goodsIssue?.issueDate ?? row.issueDate;
		row.status = goodsIssue?.status ?? row.status;
		row.goodsIssueNo = goodsIssue?.issueNo ?? row.goodsIssueNo;
	}

	// ─── item grid ──────────────────────────────────────────────────────────────
	addItem(): void {
		this.formItem.update(rows => [...rows, this._emptyItem()]);
	}

	removeItem(row: DeliveryNoteItemDto): void {
		this.formItem.update(rows => rows.filter(r => r !== row));
	}

	onGoodsIssueDetailChange(row: DeliveryNoteItemDto, id: number | null): void {
		const detail = this.goodsIssueDetailApi.items().find(p => p.id === id);

		const product = this.productApi.items().find(x => x.id == detail?.productId);
		const unit = this.unitApi.items().find(x => x.id == detail?.unitId);

		row.productId = detail?.productId ?? row.productId;
		row.productCode = product?.productCode ?? row.productCode;
		row.productName = product?.productName ?? row.productName;
		row.unitId = detail?.unitId ?? row.unitId;
		row.unitName = unit?.unitName ?? row.unitName;
		row.orderedQty = detail?.quantity ?? row.orderedQty;
		row.deliveredQty = detail?.quantity ?? row.deliveredQty;
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			deliveryNo: '',
			warehouseId: null as number | null,
			status: 1,
			vehicleNo: null as string | null,
			vehicleType: null as number | null,
			transportMethod: null as number | null,
			driverName: null as string | null,
			driverPhone: null as string | null,
			weight: null as number | null,
			volume: null as number | null,
			startedAt: null as string | null,
			completedAt: null as string | null,
			pickerId: null as number | null,
			remark: null as string | null,
			deliveryNoteSender: this._emptySender(),
			deliveryNoteReceiver: this._emptyReceiver(),

		};
	}

	private _emptySender(): DeliveryNoteSenderDto {
		return {
			id: 0,
			senderName: null as string | null,
			email1: null as string | null,
			phone1: null as string | null,
			address1: null as string | null,

			email2: null as string | null,
			phone2: null as string | null,
			address2: null as string | null,
		};
	}

	private _emptyReceiver(): DeliveryNoteReceiverDto {
		return {
			id: 0,
			receiverName: null as string | null,
			contactName: null as string | null,
			email1: null as string | null,
			phone1: null as string | null,
			address1: null as string | null,

			email2: null as string | null,
			phone2: null as string | null,
			address2: null as string | null,
		};
	}

	private _emptySource(): DeliveryNoteSourceDto {
		return {
			id: 0,
			goodsIssueId: 0,
			goodsIssueNo: null as string | null,
		};
	}

	private _emptyItem(): DeliveryNoteItemDto {
		return {
			id: 0,
			goodsIssueId: null as number | null,
			goodsIssueDetailId: null as number | null,
			productId: 0,
			productCode: null as string | null,
			productName: null as string | null,
			unitId: null as number | null,
			unitName: null as string | null,
			orderedQty: null as number | null,
			deliveredQty: null as number | null,
			remark: null as string | null,
		};
	}


	// private _validate(): string {
	// 	const groupNo = this.form.groupNo.trim();

	// 	if (!groupNo) {
	// 		return this.i18n.t('productGroup.err.groupNoRequired');
	// 	}

	// 	if (!this.form.groupName) {
	// 		return this.i18n.t('productGroup.err.groupNameRequired');
	// 	}

	// 	// IssueNo is unique across the entire goods issue list.
	// 	const clash = this.groups().find(
	// 		group =>
	// 			group.groupNo.toLowerCase() === groupNo.toLowerCase() &&
	// 			group.id !== this.editingId(),
	// 	);

	// 	return clash
	// 		? this.i18n.t('productGroup.err.groupNoTaken', { groupNo })
	// 		: '';
	// }

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveDelivery(id: number | null): Observable<DeliveryNoteDto> {
		const body: DeliveryNoteRequest = {
			deliveryNo: this.form.deliveryNo,
			warehouseId: this.form.warehouseId ?? null,
			status: this.form.status,
			vehicleNo: this.form.vehicleNo ?? null,
			vehicleType: this.form.vehicleType ?? null,
			transportMethod: this.form.transportMethod ?? null,
			driverName: this.form.driverName ?? null,
			driverPhone: this.form.driverPhone ?? null,
			weight: this.form.weight ?? null,
			volume: this.form.volume ?? null,
			startedAt: this.form.startedAt ?? null,
			completedAt: this.form.completedAt ?? null,
			pickerId: this.form.pickerId ?? null,
			remark: this.form.remark ?? null,

			deliveryNoteSources: this.formSource().map((source: DeliveryNoteSourceDto) => ({
				id: source.id > 0 ? source.id : 0,
				goodsIssueId: source.goodsIssueId,
				goodsIssueNo: source.goodsIssueNo,
			})),

			deliveryNoteItems: this.formItem().map((item: DeliveryNoteItemDto) => ({
				id: item.id > 0 ? item.id : 0,
				goodsIssueId: item.goodsIssueId,
				goodsIssueDetailId: item.goodsIssueDetailId,

				productId: item.productId,
				productCode: item.productCode,
				productName: item.productName,

				unitId: item.unitId,
				unitName: item.unitName,

				orderedQty: item.orderedQty,
				deliveredQty: item.deliveredQty,
				remark: item.remark,
			})),

			deliveryNoteSender: {
				id: this.form.deliveryNoteSender.id > 0 ? this.form.deliveryNoteSender.id : 0,
				senderName: this.form.deliveryNoteSender.senderName,
				email1: this.form.deliveryNoteSender.email1,
				email2: this.form.deliveryNoteSender.email2,
				phone1: this.form.deliveryNoteSender.phone1,
				phone2: this.form.deliveryNoteSender.phone2,
				address1: this.form.deliveryNoteSender.address1,
				address2: this.form.deliveryNoteSender.address2,
			},
			deliveryNoteReceiver: {
				id: this.form.deliveryNoteReceiver.id > 0 ? this.form.deliveryNoteReceiver.id : 0,
				receiverName: this.form.deliveryNoteReceiver.receiverName,
				contactName: this.form.deliveryNoteReceiver.contactName,
				email1: this.form.deliveryNoteReceiver.email1,
				email2: this.form.deliveryNoteReceiver.email2,
				phone1: this.form.deliveryNoteReceiver.phone1,
				phone2: this.form.deliveryNoteReceiver.phone2,
				address1: this.form.deliveryNoteReceiver.address1,
				address2: this.form.deliveryNoteReceiver.address2,
			},
		};
		console.log('body:', body);
		return id ? this.deliveryNoteApi.update(id, body) : this.deliveryNoteApi.create(body);
	}


	private _nextDeliveryNo(): string {
		const prefix = 'DE';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.deliveries().filter(r => r.deliveryNo.startsWith(prefixWithDate));

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.deliveryNo.match(
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
