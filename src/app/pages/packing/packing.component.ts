import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PackingCheckApiService, PackingCheckItemApiService, PackingPackageApiService, PackingPackageItemApiService } from '../../core/services/packing-api.service';
import { GoodsIssueApiService, GoodsIssueDetailApiService } from '../../core/services/goods-issue-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { UserApiService } from '../../core/services/organization-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { PickingPlanApiService } from '../../core/services/picking-plan-api.service';
import { PACKING_CHECK_ITEM_STATUSES, PACKING_CHECK_STATUSES, PACKING_PACKAGE_STATUSES, PACKING_PACKAGE_TYPES, PackingCheckDto, PackingCheckItemDto, PackingCheckRequest, PackingPackageDto, PackingPackageItemDto } from '../../domain/models/packing.model';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { productStatusOf } from '../../domain/models/product.model';
import { PickingTicketItemDto } from '../../domain/models/picking-plan.model';

type EntityKind = 'packingCheck' | 'packingCheckItem' | 'packingPackage' | 'packingPackageItem';
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

interface PickingPlanOption {
	value: number;
	label: string;

	planNo: string;
	statusLabel: string;
}

@Component({
	selector: 'app-packing',
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
	templateUrl: './packing.component.html',
	styleUrl: './packing.component.scss',
})
export class PackingComponent extends PermissionAwarePage implements OnInit {
	private readonly packingCheckApi = inject(PackingCheckApiService);
	private readonly packingCheckItemApi = inject(PackingCheckItemApiService);
	private readonly packingPackageApi = inject(PackingPackageApiService);
	private readonly packingPackageItemApi = inject(PackingPackageItemApiService);

	private readonly pickingPlanApi = inject(PickingPlanApiService);
	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly userApi = inject(UserApiService);


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

	lotLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? (unit.symbol || unit.unitCode) : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	pickingPlanLabel(id?: number | null): string {
		if (id == null) return '';
		const pickingPlan = this.pickingPlanApi.items().find(u => u.id === id);
		return pickingPlan ? `${pickingPlan.planNo}` : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PACKING_CHECK_STATUSES.find(u => u.value === id);
		return status ? `${status.labelKey}` : '';
	}

	statusItemLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PACKING_CHECK_ITEM_STATUSES.find(u => u.value === id);
		return status ? `${status.labelKey}` : '';
	}

	packageTypeLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PACKING_PACKAGE_TYPES.find(u => u.value === id);
		return status ? `${status.labelKey}` : '';
	}

	statusPackageLabel(id?: number | null): string {
		if (id == null) return '';
		const status = PACKING_PACKAGE_STATUSES.find(u => u.value === id);
		return status ? `${status.labelKey}` : '';
	}

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(u => ({ label: `${u.warehouseCode} · ${u.warehouseName}`, value: u.id })));

	readonly statusOptions = computed(() =>
		PACKING_CHECK_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly itemStatusOptions = computed(() =>
		PACKING_CHECK_ITEM_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly packageTypeOptions = computed(() =>
		PACKING_PACKAGE_TYPES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly packageStatusOptions = computed(() =>
		PACKING_PACKAGE_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

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

	readonly pickingPlanOptions = computed(() =>
		this.pickingPlanApi.items().map(p => ({ label: `${p.planNo}`, value: p.id })));

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	readonly lotOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly packingCheckItemOptions = computed(() =>
		this.formItems().map(s => ({ label: `${s.uId} | ${s.productId}`, value: s.uId })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCheck = signal<PackingCheckDto | null>(null);
	readonly selectedCheckItem = signal<PackingCheckItemDto | null>(null);
	readonly selectedPackage = signal<PackingPackageDto | null>(null);
	readonly selectedPackageItem = signal<PackingPackageItemDto | null>(null);

	readonly checks = computed(() => {
		const all = this.packingCheckApi.items();
		return all;
	});

	readonly packages = computed(() => {
		const id = this.selectedCheck()?.id;
		if (id == null) return [];
		return this.packingPackageApi.items().filter(b => b.packingCheckId === id);
	});

	readonly checkItems = computed(() => {
		const id = this.selectedCheck()?.id;
		if (id == null) return [];
		return this.packingCheckItemApi.items().filter(b => b.packingCheckId === id);
	});

	readonly packageItems = computed(() => {
		const id = this.selectedPackage()?.id;
		if (id == null) return [];
		return this.packingPackageItemApi.items().filter(b => b.packingPackageId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly packingCheckTable = viewChild<Table>('packingCheckTable');
	private readonly packingCheckItemTable = viewChild<Table>('packingCheckItemTable');
	private readonly packingPackageTable = viewChild<Table>('packingPackageTable');
	private readonly packingPackageItemTable = viewChild<Table>('packingPackageItemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		packingCheck: [''],
		packingCheckItem: [''],
		packingPackage: [''],
		packingPackageItem: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			packingCheck: this.packingCheckTable(),
			packingCheckItem: this.packingCheckItemTable(),
			packingPackage: this.packingPackageTable(),
			packingPackageItem: this.packingPackageItemTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'packingCheck') {
			this.selectedCheck.set(this._reconcile(this.selectedCheck(), visible as PackingCheckDto[]));
		} else if (kind === 'packingCheckItem') {
			this.selectedCheckItem.set(this._reconcile(this.selectedCheckItem(), visible as PackingCheckItemDto[]));
		} else if (kind === 'packingPackage') {
			this.selectedPackage.set(this._reconcile(this.selectedPackage(), visible as PackingPackageDto[]));
		} else if (kind === 'packingPackageItem') {
			this.selectedPackageItem.set(this._reconcile(this.selectedPackageItem(), visible as PackingPackageItemDto[]));
		}
	}

	selectCheck(check: PackingCheckDto): void {
		if (this.selectedCheck()?.id === check.id) return;
		this.selectedCheck.set(check);
	}

	selectCheckItem(checkItem: PackingCheckItemDto): void {
		if (this.selectedCheckItem()?.id === checkItem.id) return;
		this.selectedCheckItem.set(checkItem);
	}

	selectPackage(packingPackage: PackingPackageDto): void {
		if (this.selectedPackage()?.id === packingPackage.id) return;
		this.selectedPackage.set(packingPackage);
	}

	selectPackageItem(packageItem: PackingPackageItemDto): void {
		if (this.selectedPackageItem()?.id === packageItem.id) return;
		this.selectedPackageItem.set(packageItem);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super();

		effect(() => {
			const checks = this.checks();
			untracked(() => this.selectedCheck.set(this._reconcile(this.selectedCheck(), checks)));
		});

		effect(() => {
			const checkItems = this.checkItems();
			untracked(() => this.selectedCheckItem.set(this._reconcile(this.selectedCheckItem(), checkItems)));
		});

		effect(() => {
			const packages = this.packages();
			untracked(() => this.selectedPackage.set(this._reconcile(this.selectedPackage(), packages)));
		});

		effect(() => {
			const packageItems = this.packageItems();
			untracked(() => this.selectedPackageItem.set(this._reconcile(this.selectedPackageItem(), packageItems)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			checks: this.packingCheckApi.load(),
			checkItems: this.packingCheckItemApi.load(),
			packages: this.packingPackageApi.load(),
			packageItems: this.packingPackageItemApi.load(),

			warehouses: this.warehouseApi.load(),
			users: this.userApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
			pickingPlans: this.pickingPlanApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('packingCheck.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	readonly formItems = signal<PackingCheckItemDto[]>([]);
	readonly formPackages = signal<PackingPackageDto[]>([]);

	_packingCheckItemUId = -1;
	activeTab = 'check';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('packingCheck.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), checkNo: this._nextCheckNo() };
		this.formItems.set([this._emptyItem()]);
		this.formPackages.set([this._emptyPackage()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedCheck();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		// const sender = this.packingCheckApi.items().find(s => s.deliveryNoteId === row.id);
		// const receiver = this.packingCheckApi.items().find(r => r.deliveryNoteId === row.id);

		this.form = {
			checkNo: row.checkNo,
			warehouseId: row.warehouseId,
			pickingPlanId: row.pickingPlanId,
			status: row.status,
			startedAt: this._toLocalInput(row.startedAt),
			completedAt: row.completedAt ?? null,
			checkedBy: row.checkedBy ?? null,
			remark: row.remark ?? null,
		};

		// this.formSource.set(
		// 	this.deliveryNoteSourceApi.items()
		// 		.filter(source => source.deliveryNoteId === row.id)
		// 		.map(s => {
		// 			const goodsIssue = this.goodsIssueApi.items().find(g => g.id === s.goodsIssueId);
		// 			return {
		// 				...s,
		// 				issueDate: goodsIssue?.issueDate ?? null,
		// 				status: goodsIssue?.status ?? null
		// 			};
		// 		})
		// );

		this.formItems.set(
			this.packingCheckItemApi.items()
				.filter(item => item.packingCheckId === row.id)
				.map(item => ({
					...item,
					uId: item.id ?? this._packingCheckItemUId--,
				}))
		);

		this.formPackages.set(
			this.packingPackageApi.items()
				.filter(item => item.packingCheckId === row.id)
				.map(item => ({
					...item,
					packingPackageItems: this.packingPackageItemApi.items()
						.filter(source => source.packingPackageId === item.id)
						.map(source => ({ ...source }))
				}))
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
		this._savePacking(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('packingCheck.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('packingCheck.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedCheck();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('packingCheck.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.checkNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.packingCheckApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.checkNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('packingCheck.lower') }), err),
			}),
		});
	}

	// ─── item grid ──────────────────────────────────────────────────────────────
	addItemLine(): void {
		this.formItems.update(rows => [...rows, this._emptyItem()]);
	}

	removeItemLine(row: PackingCheckItemDto): void {
		this.formItems.update(rows => rows.filter(r => r !== row));
	}

	// ─── package grid ──────────────────────────────────────────────────────────────
	addPackage(): void {
		this.formPackages.update(rows => [...rows, this._emptyPackage()]);
	}

	removePackage(row: PackingPackageDto): void {
		this.formPackages.update(rows => rows.filter(r => r !== row));

		const index = this._packNos.indexOf(row.packageNo);
		if (index >= 0) this._packNos.splice(index, 1);

	}

	addPackageLine(pack: PackingPackageDto): void {
		this.formPackages.update(rows =>
			rows.map(p => p === pack ? { ...p, packingPackageItems: [...p.packingPackageItems, this._emptyPackageItem()] } : p)
		);
	}

	removePackageLine(pack: PackingPackageDto, row: PackingPackageItemDto): void {
		this.formPackages.update(rows =>
			rows.map(p => p === pack ? { ...p, packingPackageItems: p.packingPackageItems.filter(d => d !== row) } : p)
		);
	}

	onPackingCheckItemChange(row: PackingPackageItemDto, packingCheckItemId: number | null): void {
		let packingCheckItem = this.formItems().find(p => p.id === packingCheckItemId);
		if (packingCheckItemId && packingCheckItemId <= 0) packingCheckItem = this.formItems().find(p => p.uId === packingCheckItemId);
		row.productId = packingCheckItem?.productId ?? row.productId;
		row.unitId = packingCheckItem?.unitId ?? row.unitId;

		// const pickingPlanItem = this.packingCheckItems().find(p => p.uId === packingCheckItemId);
		// // console.log('pickingPlanItem:', pickingPlanItem);
		// item.productId = pickingPlanItem?.productId ?? item.productId;
		// item.requestedQty = pickingPlanItem?.requiredQty ?? item.requestedQty;
	}


	onDetailProductChange(row: PackingPackageItemDto, productId: number | null): void {
		row.productId = productId ?? 0;
		const product = this.productApi.items().find(p => p.id === productId);
		// const receipDetail = this.goodsReceiptDetailApi.items().find(p => p.productId === productId);
		row.unitId = product?.defaultUnitId ?? row.unitId;
	}
	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			checkNo: this._nextCheckNo(),
			warehouseId: 0,
			pickingPlanId: 0,
			status: 1,
			startedAt: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			completedAt: null as string | null,
			checkedBy: null as number | null,
			remark: null as string | null,
		};
	}

	private _emptyItem(): PackingCheckItemDto {
		return {
			id: 0,
			packingCheckId: null as number | null,
			productId: 0,
			unitId: 0,
			lotId: null as number | null,
			serialNo: '',
			requiredQty: null as number | null,
			packedQty: null as number | null,
			remainingQty: null as number | null,
			discrepancyQty: null as number | null,
			status: 1,
			remark: null as string | null,
			uId: this._packingCheckItemUId--,

		};
	}

	private _emptyPackage(): PackingPackageDto {
		return {
			id: 0,
			packageNo: this._nextPackageNo(),
			packageType: 1,
			barcode: '',

			weight: 0,
			length: 0,
			width: 0,
			height: 0,
			volume: 0,
			status: 1,
			packedAt: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			packedBy: null as number | null,

			remark: null as string | null,
			packingPackageItems: [this._emptyPackageItem()]
		};
	}

	private _emptyPackageItem(): PackingPackageItemDto {
		return {
			id: 0,
			packingPackageId: null as number | null,
			packingCheckItemId: null as number | null,
			productId: 0,
			unitId: 0,
			lotId: null as number | null,
			serialNo: '',
			quantity: 0,
			barcode: '',
			scannedAt: null as string | null,
			scannedBy: null as number | null,
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

	private _savePacking(id: number | null): Observable<PackingCheckDto> {
		const body: PackingCheckRequest = {
			checkNo: this.form.checkNo,
			warehouseId: this.form.warehouseId,
			pickingPlanId: this.form.pickingPlanId,

			status: this.form.status,

			startedAt: this.form.startedAt ?? null,
			completedAt: this.form.completedAt ?? null,
			checkedBy: this.form.checkedBy ?? null,
			remark: this.form.remark ?? null,

			packingCheckItems: this.formItems().map((item: PackingCheckItemDto) => ({
				id: item.id > 0 ? item.id : 0,
				packingCheckId: item.packingCheckId ?? null,
				productId: item.productId,
				unitId: item.unitId,
				lotId: item.lotId ?? null,
				serialNo: item.serialNo,
				requiredQty: item.requiredQty ?? null,
				packedQty: item.packedQty ?? null,
				remainingQty: item.remainingQty ?? null,
				discrepancyQty: item.discrepancyQty ?? null,
				status: item.status,
				remark: item.remark ?? null,
				uId: item.uId,
			})),

			packingPackages: this.formPackages().map((pack: PackingPackageDto) => ({
				id: pack.id > 0 ? pack.id : 0,
				packingCheckId: pack.packingCheckId ?? null,

				packageNo: pack.packageNo,
				packageType: pack.packageType,
				barcode: pack.barcode ?? null,

				weight: pack.weight,
				length: pack.length,
				width: pack.width,
				height: pack.height,
				volume: pack.volume,

				status: pack.status,

				packedAt: pack.packedAt ?? null,
				packedBy: pack.packedBy ?? null,

				remark: pack.remark ?? null,

				packingPackageItems: pack.packingPackageItems.map((item: PackingPackageItemDto) => ({
					id: item.id > 0 ? item.id : 0,
					packingPackageId: item.packingPackageId ?? null,
					packingCheckItemId: item.packingCheckItemId ?? null,

					productId: item.productId,
					unitId: item.unitId,
					lotId: item.lotId ?? null,
					serialNo: item.serialNo,

					quantity: item.quantity,
					barcode: item.barcode ?? null,

					scannedAt: item.scannedAt ?? null,
					scannedBy: item.scannedBy ?? null,
					remark: item.remark ?? null,
				})),

			})),


		};
		console.log('body:', body);
		// return null as any;
		return id ? this.packingCheckApi.update(id, body) : this.packingCheckApi.create(body);
	}

	private _toLocalInput(value: string | null | undefined): string {
		if (!value) return '';
		const date = new Date(value);
		return isNaN(date.getTime()) ? '' : formatDate(date, DATETIME_LOCAL, 'en-US');
	}


	private _nextCheckNo(): string {
		const prefix = 'PC';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.checks().filter(r => r.checkNo.startsWith(prefixWithDate));

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.checkNo.match(
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

	_packNos: string[] = [];
	private _nextPackageNo(): string {
		const prefix = 'PK';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.packages().filter(r =>
			r.packageNo.startsWith(prefixWithDate),
		);

		this._packNos.push(...existing.map(r => r.packageNo));

		let stt = 1;

		if (this._packNos.length > 0) {
			const numbers = this._packNos
				.map(r => {
					const match = r.match(
						new RegExp(`^${prefix}_${datePart}_(\\d+)$`),
					);

					return match ? Number(match[1]) : 0;
				})
				.filter(n => n > 0);

			if (numbers.length > 0) {
				stt = Math.max(...numbers) + 1;
			}
		}

		let packageNo = `${prefixWithDate}${String(stt).padStart(3, '0')}`
		this._packNos.push(packageNo);
		return packageNo;
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
