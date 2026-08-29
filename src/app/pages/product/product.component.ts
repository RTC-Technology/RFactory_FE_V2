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
import { InputNumberModule } from 'primeng/inputnumber';
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
	BomApiService, BomDetailApiService, ProductApiService, ProductGroupApiService, ProductTypeApiService, RoutingApiService,
	RoutingOperationApiService, UnitApiService,
} from '../../core/services/product-api.service';
import {
	BomDetailDto, BomDto, ProductDto, PRODUCT_STATUSES, RoutingDto, RoutingOperationDto, productStatusOf,
	PRODUCT_NATURES,
	PRODUCT_WARRANTY_PERIOD_UNITS,
	ProductRequest,
	BomRequest,
} from '../../domain/models/product.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { Textarea } from "primeng/textarea";
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ColorPickerModule } from 'primeng/colorpicker';
import { PanelModule } from 'primeng/panel';
import { SplitterModule } from 'primeng/splitter';
import { SplitStateService } from '../../core/services/split-state.service';

type EntityKind = 'product' | 'bom' | 'bomDetail' | 'routing' | 'routingOp';
const LABEL_KEYS: Record<EntityKind, string> = {
	product: 'product.lower',
	bom: 'bom.lower',
	bomDetail: 'bomDetail.lower',
	routing: 'routing.lower',
	routingOp: 'routing.op.lower',
};


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
	selector: 'app-product',
	standalone: true,
	imports: [
		CommonModule, FormsModule,
		TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
		InputTextModule, InputNumberModule, SelectModule, TagModule, ToggleSwitchModule, CheckboxModule, TabsModule,
		HasPermissionDirective, SplitterModule,
		Textarea, InputGroupModule, InputGroupAddonModule, ColorPickerModule, PanelModule
	],
	providers: [MessageService, ConfirmationService],
	templateUrl: './product.component.html',
	styleUrl: './product.component.scss',
})
export class ProductComponent extends PermissionAwarePage implements OnInit {
	private readonly productApi = inject(ProductApiService);
	private readonly typeApi = inject(ProductTypeApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly groupApi = inject(ProductGroupApiService);

	private readonly bomApi = inject(BomApiService);
	private readonly bomDetailApi = inject(BomDetailApiService);
	private readonly routingApi = inject(RoutingApiService);
	private readonly routingOpApi = inject(RoutingOperationApiService);
	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly statusOf = productStatusOf;

	readonly loading = computed(() =>
		this.productApi.loading() || this.bomApi.loading()
		|| this.routingApi.loading() || this.routingOpApi.loading());

	// ─── Lookups ────────────────────────────────────────────────────────────────

	productTypeLabel(id?: number | null): string {
		return this.typeApi.items().find(t => t.id === id)?.productTypeName ?? '';
	}

	unitLabel(id?: number | null): string {
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? (unit.symbol || unit.unitCode) : '';
	}

	productGroupLabel(id?: number | null): string {
		const group = this.groupApi.items().find(g => g.id === id);
		return group ? `${group.groupNo} · ${group.groupName}` : '';
	}

	warrantyPeriodUnitLabel(value?: number | null): string {
		const unit = PRODUCT_WARRANTY_PERIOD_UNITS.find(s => s.value === value);
		return unit ? this.i18n.t(unit.labelKey) : '';
	}

	warehouseLabel(id?: number | null): string {
		const warehouse = this.warehouseApi.items().find(w => w.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	productNatureLabel(value?: number | null): string {
		const unit = PRODUCT_NATURES.find(s => s.value === value);
		return unit ? this.i18n.t(unit.labelKey) : '';
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

	/** Candidates for a BOM line: any product can be consumed as raw material / semi-finished. */
	readonly bomComponentOptions = computed(() =>
		this.productApi.items().map(p => ({ label: `${p.productCode} · ${p.productName}`, value: p.id })));

	productLabel(id?: number | null): string {
		const p = this.productApi.items().find(p => p.id === id);
		return p ? `${p.productCode} · ${p.productName}` : '';
	}

	readonly statusOptions = computed(() =>
		PRODUCT_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly productNatureOptions = computed(() =>
		PRODUCT_NATURES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly productGroupOptions = computed(() =>
		this.groupApi.items().map(s => ({ label: `${s.groupNo} · ${s.groupName}`, value: s.id })));

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(s => ({ label: `${s.warehouseCode} · ${s.warehouseName}`, value: s.id })));

	readonly warrantyPeriodUnitOptions = computed(() =>
		PRODUCT_WARRANTY_PERIOD_UNITS.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────

	/** The product the detail modal is showing; every tab scopes off it. */
	readonly selectedProduct = signal<ProductDto | null>(null);
	readonly selectedBom = signal<BomDto | null>(null);
	readonly selectedBomDetail = signal<BomDetailDto | null>(null);
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

	bomDetails(row: BomDto | null) {
		if (!row) return [];
		return this.bomDetailApi.items().filter(
			x => x.bomId === row.id
		);
	}
	routingOps(row: RoutingDto | null) {
		if (!row) return [];
		return this.routingOpApi.items().filter(
			x => x.routingId === row.id
		);
	}

	// readonly routingOps = computed(() => {
	// 	const routingId = this.selectedRouting()?.id;
	// 	if (routingId == null) return [];
	// 	return this.routingOpApi.items().filter(o => o.routingId === routingId);
	// });

	// readonly bomDetails = computed(() => {
	// 	const bomId = this.selectedBom()?.id;
	// 	if (bomId == null) return [];
	// 	return this.bomDetailApi.items().filter(d => d.bomId === bomId);
	// });

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
			const details = this.bomDetails(this.selectedBom());
			untracked(() => this.selectedBomDetail.set(this._reconcile(this.selectedBomDetail(), details)));
		});
		effect(() => {
			const routings = this.routings();
			untracked(() => this.selectedRouting.set(this._reconcile(this.selectedRouting(), routings)));
		});
		effect(() => {
			const ops = this.routingOps(this.selectedRouting());
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
			groups: this.groupApi.load(),
			warehouses: this.warehouseApi.load(),
			boms: this.bomApi.load(),
			bomDetails: this.bomDetailApi.load(),
			routings: this.routingApi.load(),
			routingOps: this.routingOpApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('product.err.load'), err),
		});
	}

	calculateProductTotal(productGroupId: number) {
		let total = 0;

		if (this.products()) {
			for (let product of this.products()) {
				if ((product.productGroupId ?? 0) === productGroupId) {
					total++;
				}
			}
		}

		return total;
	}

	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly productTable = viewChild<Table>('productTable');
	private readonly bomTable = viewChild<Table>('bomTable');
	private readonly bomDetailTable = viewChild<Table>('bomDetailTable');
	private readonly routingTable = viewChild<Table>('routingTable');
	private readonly routingOpTable = viewChild<Table>('routingOpTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		product: ['productCode', 'productName', 'drawingNo'],
		bom: ['bomCode', 'bomName', 'version'],
		bomDetail: [],
		routing: ['version'],
		routingOp: ['routingOperationCode', 'routingOperationName', 'description'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			product: this.productTable(), bom: this.bomTable(), bomDetail: this.bomDetailTable(),
			routing: this.routingTable(), routingOp: this.routingOpTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'product') {
			this.selectedProduct.set(this._reconcile(this.selectedProduct(), visible as ProductDto[]));
		} else if (kind === 'bom') {
			this.selectedBom.set(this._reconcile(this.selectedBom(), visible as BomDto[]));
		} else if (kind === 'bomDetail') {
			this.selectedBomDetail.set(this._reconcile(this.selectedBomDetail(), visible as BomDetailDto[]));
		} else if (kind === 'routing') {
			this.selectedRouting.set(this._reconcile(this.selectedRouting(), visible as RoutingDto[]));
		} else if (kind === 'routingOp') {
			this.selectedRoutingOp.set(this._reconcile(this.selectedRoutingOp(), visible as RoutingOperationDto[]));
		}
	}

	selectProduct(product: ProductDto): void {
		if (this.selectedProduct()?.id === product.id) return;
		this.selectedProduct.set(product);
	}

	selectBom(bom: BomDto): void {
		this.selectedBom.set(bom);
	}

	selectBomDetail(detail: BomDetailDto): void {
		this.selectedBomDetail.set(detail);
	}

	selectRouting(routing: RoutingDto): void {
		this.selectedRouting.set(routing);
		this.selectedRoutingOp.set(this._first(this.routingOps(routing)));
	}

	selectRoutingOp(op: RoutingOperationDto): void {
		this.selectedRoutingOp.set(op);
	}

	// ─── Detail modal ───────────────────────────────────────────────────────────

	readonly detailOpen = signal(false);
	readonly detailTab = signal<string>('info');

	readonly detailTitle = computed(() => {
		const product = this.selectedProduct();
		if (product) {
			return this.i18n.t('product.detailOf', { name: `${product.productCode} · ${product.productName}` });
		}
		// Fresh entry: the modal doubles as the retired "add product" dialog.
		return this.i18n.t('plant.dialog.add', { entity: this.i18n.t('product.lower') });
	});

	/** True while the detail modal is open for a brand-new product (blank Thông tin form). */
	// readonly creatingProduct = computed(() => this.detailOpen() && !this.selectedProduct());

	// ─── CRUD dialog ───────────────────────────────────────────────────────────

	readonly dialogOpen = signal(false);
	readonly dialogKind = signal<EntityKind>('product');
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly bomRows = signal<BomDto[]>([]);
	readonly routingRows = signal<RoutingDto[]>([]);

	readonly activeTab = signal<string>('product');
	private _tempDetailId = 0;
	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('product.lower'),
		}));

	openCreate(): void {

		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };
		// A receipt with no line is meaningless, so start the operator on one.
		this.bomRows.set([this._emptyBom()]);
		this.routingRows.set([this._emptyRouting()]);

		this.dialogOpen.set(true);
	}

	openEdit(kind: EntityKind): void {

		const row = this.selectedProduct();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');
		this.form = {
			productCode: row.productCode.trim(),
			productName: row.productName.trim(),
			productTypeId: row.productTypeId ?? null,
			defaultUnitId: row.defaultUnitId ?? null,
			drawingNo: row.drawingNo?.trim() || null,
			drawingPath: row.drawingPath?.trim() || null,
			status: row.status ?? 1,
			productNature: row.productNature ?? null,
			productGroupId: row.productGroupId ?? null,
			productionUnitId: row.productionUnitId ?? null,
			defaultWarehouseId: row.defaultWarehouseId ?? null,
			minStock: row.minStock ?? null,
			maxStock: row.maxStock ?? null,
			fixedPurchasePrice: row.fixedPurchasePrice ?? null,
			wastageRate: row.wastageRate ?? null,
			preparationTime: row.preparationTime ?? null,
			warrantyPeriod: row.warrantyPeriod ?? null,
			warrantyPeriodUnit: row.warrantyPeriodUnit ?? 2,
			vatRate: row.vatRate ?? null,
			standardProductionTime: row.standardProductionTime ?? null,
			isOutsourced: row.isOutsourced ?? false,
			description: row.description ?? null,
			productionColor: row.productionColor ?? null,
			// boms: this.bomRows().map(row => ({
			// 	id: row.id > 0 ? row.id : 0,
			// 	productId: row.productId,
			// 	bomCode: row.bomCode?.trim() || '',
			// 	bomName: row.bomName?.trim() || '',
			// 	version: row.version?.trim() || null,
			// 	status: row.status,
			// 	isActive: row.isActive,
			// 	bomDetails: row.bomDetails.map((op: BomDetailDto) => ({
			// 		id: op.id > 0 ? op.id : 0,
			// 		bomId: op.bomId,
			// 		productId: op.productId,
			// 		quantity: op.quantity,
			// 		unitId: op.unitId,
			// 		scrapRate: op.scrapRate,
			// 		fixedScrapQty: op.fixedScrapQty,
			// 	})),
			// })),
			// routings: this.routingRows().map(row => ({
			// 	id: row.id > 0 ? row.id : 0,
			// 	productId: row.productId,
			// 	version: row.version?.trim() || '',
			// 	isActive: row.isActive,
			// 	routingOperations: row.routingOperations.map((op: RoutingOperationDto) => ({
			// 		id: op.id > 0 ? op.id : 0,
			// 		routingId: op.routingId,
			// 		sequence: op.sequence,
			// 		routingOperationCode: op.routingOperationCode?.trim() || '',
			// 		routingOperationName: op.routingOperationName?.trim() || '',
			// 		description: op.description?.trim() || null,
			// 		isFinishOperation: op.isFinishOperation,
			// 		isOutputOperation: op.isOutputOperation,
			// 	})),
			// })),
		};

		this.bomRows.set(
			this.bomApi.items()
				.filter(bom => bom.productId === row.id)
				.map(bom => ({
					...bom,
					bomDetails: this.bomDetailApi.items()
						.filter(detail => detail.bomId === bom.id)
						.map(detail => ({ ...detail }))
				}))
		);

		this.routingRows.set(
			this.routingApi.items()
				.filter(routing => routing.productId === row.id)
				.map(routing => ({
					...routing,
					routingOperations: this.routingOpApi.items()
						.filter(op => op.routingId === routing.id)
						.map(op => ({ ...op }))
				}))
		);

		this.activeTab.set(kind);
		this.dialogOpen.set(true);
	}

	save(): void {
		const error = this._validate() || this._validateBoms() || this._validateRouting();
		if (error) {
			this.formError.set(error);
			return;
		}

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		// One call carrying the header and every line: the backend writes them in a single
		// transaction, so a rejected line cannot leave a receipt behind.
		this._saveProduct(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('purchaseOrder.lower'),
				}));

			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('purchaseOrder.lower') }));
			},
		});
	}

	askDelete(kind: EntityKind): void {
		const row = {
			product: this.selectedProduct(), bom: this.selectedBom(), bomDetail: this.selectedBomDetail(),
			routing: this.selectedRouting(), routingOp: this.selectedRoutingOp(),
		}[kind];
		if (!row) return;

		const label = kind === 'product' ? (row as ProductDto).productName
			: kind === 'bom' ? (row as BomDto).bomName
				: kind === 'bomDetail' ? this.productLabel((row as BomDetailDto).productId) || `#${(row as BomDetailDto).id}`
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

	// ─── Bom grid ──────────────────────────────────────────────────────────────
	addBomRow(): void {
		this.bomRows.update(rows => [...rows, this._emptyBom()]);
	}

	removeBomRow(bom: BomDto): void {
		this.bomRows.update(rows => rows.filter(r => r !== bom));
	}

	addBomDetailRow(bom: BomDto): void {
		this.bomRows.update(rows =>
			rows.map(b => b === bom ? { ...b, bomDetails: [...b.bomDetails, this._emptyBomDetail()] } : b)
		);
	}

	removeBomDetailRow(bom: BomDto, row: BomDetailDto): void {
		this.bomRows.update(rows =>
			rows.map(b => b === bom ? { ...b, bomDetails: b.bomDetails.filter(d => d !== row) } : b)
		);
	}

	onDetailProductChange(
		row: BomDetailDto,
		productId: number | null
	): void {
		row.productId = productId ?? 0;

		const product = this.productApi.items()
			.find(p => p.id === productId);

		row.unitId = product?.defaultUnitId ?? row.unitId;
	}

	bomDetailTotal(bom: BomDto): number {
		return bom.bomDetails.reduce(
			(total, d) => total + (d.quantity || 0),
			0
		);
	}

	// ─── Routing grid ──────────────────────────────────────────────────────────────
	addRoutingRow(): void {
		this.routingRows.update(rows => [...rows, this._emptyRouting()]);
	}

	removeRoutingRow(r: RoutingDto): void {
		this.routingRows.update(rows => rows.filter(row => row !== r));
	}

	addRoutingOperationRow(r: RoutingDto): void {
		this.routingRows.update(rows =>
			rows.map(b => b === r ? { ...b, routingOperations: [...b.routingOperations, this._emptyRoutingOperation()] } : b)
		);
	}

	removeRoutingOperationRow(r: RoutingDto, row: RoutingOperationDto): void {
		this.routingRows.update(rows =>
			rows.map(b => b === r ? { ...b, routingOperations: b.routingOperations.filter(d => d !== row) } : b)
		);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────

	private _apiFor(kind: EntityKind) {
		return {
			product: this.productApi, bom: this.bomApi, bomDetail: this.bomDetailApi,
			routing: this.routingApi, routingOp: this.routingOpApi,
		}[kind];
	}

	private _emptyForm() {
		return {
			// id: 0,
			productCode: '',
			productName: '',
			productTypeId: null as number | null,
			defaultUnitId: null as number | null,
			drawingNo: null as string | null,
			drawingPath: null as string | null,
			status: 1,
			productNature: null as number | null,
			productGroupId: null as number | null,
			productionUnitId: null as number | null,
			defaultWarehouseId: null as number | null,
			minStock: null as number | null,
			maxStock: null as number | null,
			fixedPurchasePrice: null as number | null,
			wastageRate: null as number | null,
			preparationTime: null as number | null,
			warrantyPeriod: null as number | null,
			warrantyPeriodUnit: 2,
			vatRate: null as number | null,
			standardProductionTime: null as number | null,
			isOutsourced: false,
			description: null as string | null,
			productionColor: null as string | null,
		};
	}

	private _emptyBom(): BomDto {
		return {
			id: 0,
			bomCode: '',
			bomName: '',
			version: '',
			status: 1,
			isActive: true,
			bomDetails: [this._emptyBomDetail()],
		};
	}

	private _emptyBomDetail(): BomDetailDto {
		return {
			id: --this._tempDetailId,
			bomId: 0,
			productId: 0,
			quantity: 0,
			unitId: 0,
			scrapRate: 0,
			fixedScrapQty: 0,
		};
	}

	private _emptyRouting(): RoutingDto {
		return {
			id: 0,
			productId: 0,
			version: '',
			isActive: true,
			routingOperations: [this._emptyRoutingOperation()],
		};
	}

	private _emptyRoutingOperation(): RoutingOperationDto {
		return {
			id: --this._tempDetailId,
			sequence: 0,
			routingOperationCode: '',
			routingOperationName: '',
			description: '',
			isFinishOperation: false,
			isOutputOperation: false,
		};
	}

	private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
		const match = current ? rows.find(row => row.id === current.id) : undefined;
		return match ?? rows[0] ?? null;
	}

	private _first<T extends { id: number }>(rows: T[]): T | null {
		return rows[0] ?? null;
	}

	private _validate(): string {
		const productCode = this.form.productCode.trim();

		if (!productCode) {
			return this.i18n.t('product.err.productCodeRequired');
		}

		if (!this.form.productName) {
			return this.i18n.t('product.err.productNameRequired');
		}

		// ProductCode is unique across the entire product list.
		const clash = this.productApi.items().find(
			product =>
				product.productCode.toLowerCase() === productCode.toLowerCase() &&
				product.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('product.err.productCodeTaken', { productCode })
			: '';
	}

	private _validateBoms(): string {

		if (this.bomRows().length > 0) {
			for (let i = 0; i < this.bomRows().length; i++) {
				const row = this.bomRows()[i];
				const line = `#${i + 1}`;

				if (!row.bomCode) return this.i18n.t('bom.err.codeRequired', { line });
				if (!row.bomName) return this.i18n.t('bom.err.nameRequired', { line });
				if (!row.version) return this.i18n.t('bom.err.versionRequired', { line });

				// Validate bom details
				if (!row.bomDetails) return this.i18n.t('bomDetail.err.linesRequired', { line });

				if (row.bomDetails.length === 0) return this.i18n.t('bomDetail.err.linesRequired', { line });

				for (let j = 0; j < row.bomDetails.length; j++) {
					const detail = row.bomDetails[j];
					const line = j + 1;

					if (!detail.productId) return this.i18n.t('bomDetail.err.productRequired', { line });
					if (!detail.quantity) return this.i18n.t('bomDetail.err.quantityRequired', { line });
					if (detail.quantity <= 0) return this.i18n.t('bomDetail.err.quantityInvalid', { line });
				}
			}
		}
		return '';
	}

	private _validateRouting(): string {

		if (this.routingRows().length > 0) {
			for (let i = 0; i < this.routingRows().length; i++) {
				const row = this.routingRows()[i];
				const line = `#${i + 1}`;

				if (!row.version) return this.i18n.t('routing.err.versionRequired', { line });

				// Validate bom details
				if (!row.routingOperations) return this.i18n.t('routingOperation.err.linesRequired', { line });

				if (row.routingOperations.length === 0) return this.i18n.t('routingOperation.err.linesRequired', { line });

				for (let j = 0; j < row.routingOperations.length; j++) {
					const detail = row.routingOperations[j];
					const line = j + 1;

					if (!detail.sequence) return this.i18n.t('routingOperation.err.sequenceRequired', { line });
					if (!detail.routingOperationCode) return this.i18n.t('routingOperation.err.codeRequired', { line });
					if (!detail.routingOperationName) return this.i18n.t('routingOperation.err.nameRequired', { line });

				}
			}
		}
		return '';
	}


	private _saveProduct(id: number | null): Observable<ProductDto> {
		const body: ProductRequest = {
			productCode: this.form.productCode.trim(),
			productName: this.form.productName.trim(),
			productTypeId: this.form.productTypeId ?? null,
			defaultUnitId: this.form.defaultUnitId ?? null,
			drawingNo: this.form.drawingNo?.trim() || null,
			drawingPath: this.form.drawingPath?.trim() || null,
			status: this.form.status,
			productNature: this.form.productNature ?? null,
			productGroupId: this.form.productGroupId ?? null,
			productionUnitId: this.form.productionUnitId ?? null,
			defaultWarehouseId: this.form.defaultWarehouseId ?? null,
			minStock: this.form.minStock ?? null,
			maxStock: this.form.maxStock ?? null,
			fixedPurchasePrice: this.form.fixedPurchasePrice ?? null,
			wastageRate: this.form.wastageRate ?? null,
			preparationTime: this.form.preparationTime ?? null,
			warrantyPeriod: this.form.warrantyPeriod ?? null,
			warrantyPeriodUnit: this.form.warrantyPeriodUnit ?? 2,
			vatRate: this.form.vatRate ?? null,
			standardProductionTime: this.form.standardProductionTime ?? null,
			isOutsourced: this.form.isOutsourced ?? false,
			description: this.form.description ?? null,
			productionColor: this.form.productionColor ?? null,
			boms: this.bomRows().map(row => ({
				id: row.id > 0 ? row.id : 0,
				productId: row.productId,
				bomCode: row.bomCode?.trim() || '',
				bomName: row.bomName?.trim() || '',
				version: row.version?.trim() || null,
				status: row.status,
				isActive: row.isActive,
				bomDetails: row.bomDetails.map((op: BomDetailDto) => ({
					id: op.id > 0 ? op.id : 0,
					bomId: op.bomId,
					productId: op.productId,
					quantity: op.quantity,
					unitId: op.unitId,
					scrapRate: op.scrapRate,
					fixedScrapQty: op.fixedScrapQty,
				})),
			})),
			routings: this.routingRows().map(row => ({
				id: row.id > 0 ? row.id : 0,
				productId: row.productId,
				version: row.version?.trim() || '',
				isActive: row.isActive,
				routingOperations: row.routingOperations.map((op: RoutingOperationDto) => ({
					id: op.id > 0 ? op.id : 0,
					routingId: op.routingId,
					sequence: op.sequence,
					routingOperationCode: op.routingOperationCode?.trim() || '',
					routingOperationName: op.routingOperationName?.trim() || '',
					description: op.description?.trim() || null,
					isFinishOperation: op.isFinishOperation,
					isOutputOperation: op.isOutputOperation,
				})),
			})),
		};
		return id ? this.productApi.update(id, body) : this.productApi.create(body);
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
