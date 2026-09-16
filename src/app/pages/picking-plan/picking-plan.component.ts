import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule, Checkbox } from 'primeng/checkbox';
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
import { ConfirmationService, MessageService } from 'primeng/api';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { HttpErrorResponse } from '@angular/common/http';
import { PICKING_PLAN_ITEM_STATUSES, PICKING_PLAN_SOURCE_TYPES, PICKING_PLAN_STATUSES, PICKING_TICKET_ITEM_STATUSES, PICKING_TICKET_STATUSES, PickingPlanDto, PickingPlanItemDto, PickingPlanItemSourceDto, PickingPlanRequest, PickingPlanSourceDto, PickingTicketDto, PickingTicketItemDto } from '../../domain/models/picking-plan.model';
import { forkJoin, Observable } from 'rxjs';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { WarehouseApiService, WarehouseLocationApiService } from '../../core/services/warehouse-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { UserGroupApiService } from '../../core/services/user-group-api.service';
import { GoodsIssueApiService, GoodsIssueDetailApiService } from '../../core/services/goods-issue-api.service';
import { GOODS_ISSUE_STATUSES } from '../../domain/models/goods-issue.model';
import { productStatusOf } from '../../domain/models/product.model';
import { PickingPlanApiService, PickingPlanItemApiService, PickingPlanItemSourceApiService, PickingPlanSourceApiService, PickingTicketApiService, PickingTicketItemApiService } from '../../core/services/picking-plan-api.service';
import { UserApiService } from '../../core/services/organization-api.service';

type EntityKind = 'pickingPlan' | 'planSources' | 'pickingPlanItem' | 'pickingTicket';

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

interface PickingPlanSourceOption {
	value: number;
	label: string;

	sourceNo: string;
	sourceDate: string;
	statusLabel: string;
}

interface PickingPlanSourceDetailOption {
	value: number;
	label: string;

	productId: number;
	unit: string;
	location: string;
	lotNo: string;
	serialNo: string;
	quantity: number;
}



@Component({
	selector: 'app-picking-plan',
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
	templateUrl: './picking-plan.component.html',
	styleUrl: './picking-plan.component.scss',
})
export class PickingPlanComponent extends PermissionAwarePage implements OnInit {

	private readonly pickingPlanApi = inject(PickingPlanApiService);
	private readonly pickingPlanItemApi = inject(PickingPlanItemApiService);
	private readonly pickingPlanItemSourceApi = inject(PickingPlanItemSourceApiService);
	private readonly pickingPlanSourceApi = inject(PickingPlanSourceApiService);
	private readonly pickingTicketApi = inject(PickingTicketApiService);
	private readonly pickingTicketItemApi = inject(PickingTicketItemApiService);

	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly locationApi = inject(WarehouseLocationApiService);
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
		const warehouse = this.warehouseApi.items().find(w => w.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	productLabel(id?: number | null): string {
		const product = this.productApi.items().find(p => p.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	unitLabel(id?: number | null): string {
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? (unit.symbol || unit.unitCode) : '';
	}

	locationLabel(id?: number | null): string {
		const location = this.locationApi.items().find(l => l.id === id);
		return location ? `${location.warehouseLocationCode} · ${location.warehouseLocationName}` : '';
	}

	userLabel(id?: number | null): string {
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	sourceTypeLabel(id?: number | null): string {
		const sourceType = PICKING_PLAN_SOURCE_TYPES.find(s => s.value === id);
		return sourceType ? this.i18n.t(sourceType.labelKey) : '';
	}

	ticketStatusLabel(id?: number | null): string {
		const status = PICKING_TICKET_STATUSES.find(s => s.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	planStatusLabel(id?: number | null): string {
		const status = PICKING_PLAN_STATUSES.find(s => s.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	planItemStatusLabel(id?: number | null): string {
		const status = PICKING_PLAN_ITEM_STATUSES.find(s => s.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(u => ({ label: `${u.warehouseCode} · ${u.warehouseName}`, value: u.id })));

	readonly statusOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly sourceTypeOptions = computed(() =>
		PICKING_PLAN_SOURCE_TYPES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly sourceOptions = (sourceType: number = 0): PickingPlanSourceOption[] => {
		return this.goodsIssueApi.items()
			.filter(x => x.issueType == sourceType || sourceType == 0)
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
	};

	readonly sourcePlanOptions = (): PickingPlanSourceOption[] => {
		return this.goodsIssueApi.items()
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

	readonly itemStatusOptions = computed(() =>
		PICKING_PLAN_ITEM_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	// readonly sourceDetailOptions = computed(() =>
	// 	this.goodsIssueDetailApi.items().map(u => ({ label: `${u.productId} · ${u.quantity}`, value: u.id })));

	readonly sourceDetailOptions = (sourceId: number | null): PickingPlanSourceDetailOption[] => {
		return this.goodsIssueDetailApi.items()
			.filter(x => x.goodsIssueId == sourceId)
			.map(p => {
				return {
					value: p.id,
					label: this.productLabel(p.productId),
					productId: p.productId,
					unit: this.unitLabel(p.unitId),
					location: this.locationLabel(p.locationId),
					lotNo: p.lotNo || '',
					serialNo: p.serialNo || '',
					quantity: p.quantity || 0,
				};
			});
	};

	readonly ticketStatusOptions = computed(() =>
		PICKING_TICKET_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly planItemOptions = computed(() =>
		this.pickingPlanItems().map(s => ({ label: this.productLabel(s.productId), value: s.uId })));

	readonly locationOptions = computed(() =>
		this.locationApi.items().map(u => ({ label: `${u.warehouseLocationCode} · ${u.warehouseLocationName}`, value: u.id })));

	readonly lotOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly ticketItemStatusOptions = computed(() =>
		PICKING_TICKET_ITEM_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedPickingPlan = signal<PickingPlanDto | null>(null);
	readonly selectedPickingPlanItem = signal<PickingPlanItemDto | null>(null);
	readonly selectedPickingPlanItemSource = signal<PickingPlanItemSourceDto | null>(null);
	readonly selectedPickingPlanSource = signal<PickingPlanSourceDto | null>(null);
	readonly selectedPickingTicket = signal<PickingTicketDto | null>(null);
	readonly selectedPickingTicketItem = signal<PickingTicketItemDto | null>(null);

	readonly plans = computed(() => {
		const all = this.pickingPlanApi.items();
		return all;
	});

	readonly planItems = computed(() => {
		const id = this.selectedPickingPlan()?.id;
		if (id == null) return [];
		return this.pickingPlanItemApi.items().filter(b => b.pickingPlanId === id);
	});

	readonly planSources = computed(() => {
		const id = this.selectedPickingPlan()?.id;
		if (id == null) return [];
		return this.pickingPlanSourceApi.items().filter(b => b.pickingPlanId === id);
	});

	readonly planItemSources = computed(() => {
		const id = this.selectedPickingPlanItem()?.id;
		if (id == null) return [];
		return this.pickingPlanItemSourceApi.items().filter(b => b.pickingPlanItemId === id);
	});

	readonly tickets = computed(() => {
		const id = this.selectedPickingPlan()?.id;
		if (id == null) return [];
		return this.pickingTicketApi.items().filter(b => b.pickingPlanId === id);
	});

	readonly ticketItems = computed(() => {
		const id = this.selectedPickingTicket()?.id;
		if (id == null) return [];
		return this.pickingTicketItemApi.items().filter(b => b.pickingTicketId === id);
	});



	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly pickingPlanTable = viewChild<Table>('pickingPlanTable');
	private readonly planSourcesTable = viewChild<Table>('planSourcesTable');
	private readonly pickingPlanItemTable = viewChild<Table>('pickingPlanItemTable');
	private readonly pickingTicketTable = viewChild<Table>('pickingTicketTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		pickingPlan: [''],
		planSources: [''],
		pickingPlanItem: [''],
		pickingTicket: ['']
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			pickingPlan: this.pickingPlanTable(),
			planSources: this.planSourcesTable(),
			pickingPlanItem: this.pickingPlanItemTable(),
			pickingTicket: this.pickingTicketTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'pickingPlan') {
			this.selectedPickingPlan.set(this._reconcile(this.selectedPickingPlan(), visible as PickingPlanDto[]));
		}
	}

	selectPickingPlan(pickingPlan: PickingPlanDto): void {
		if (this.selectedPickingPlan()?.id === pickingPlan.id) return;
		this.selectedPickingPlan.set(pickingPlan);
	}

	selectPickingPlanSource(source: PickingPlanSourceDto): void {
		if (this.selectedPickingPlanSource()?.id === source.id) return;
		this.selectedPickingPlanSource.set(source);
	}

	selectPickingPlanItem(item: PickingPlanItemDto): void {
		if (this.selectedPickingPlanItem()?.id === item.id) return;
		this.selectedPickingPlanItem.set(item);
	}
	selectPickingPlanItemSource(item: PickingPlanItemSourceDto): void {
		if (this.selectedPickingPlanItemSource()?.id === item.id) return;
		this.selectedPickingPlanItemSource.set(item);
	}

	selectPickingTicket(ticket: PickingTicketDto): void {
		if (this.selectedPickingTicket()?.id === ticket.id) return;
		this.selectedPickingTicket.set(ticket);
	}

	selectPickingTicketItem(ticketItem: PickingTicketItemDto): void {
		if (this.selectedPickingTicketItem()?.id === ticketItem.id) return;
		this.selectedPickingTicketItem.set(ticketItem);
	}


	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super();

		effect(() => {
			const pickingPlans = this.plans();
			untracked(() => this.selectedPickingPlan.set(this._reconcile(this.selectedPickingPlan(), pickingPlans)));
		});

		effect(() => {
			const sources = this.planSources();
			untracked(() => this.selectedPickingPlanSource.set(this._reconcile(this.selectedPickingPlanSource(), sources)));
		});

		effect(() => {
			const items = this.planItems();
			untracked(() => this.selectedPickingPlanItem.set(this._reconcile(this.selectedPickingPlanItem(), items)));
		});

		effect(() => {
			const sources = this.planItemSources();
			untracked(() => this.selectedPickingPlanItemSource.set(this._reconcile(this.selectedPickingPlanItemSource(), sources)));
		});

		effect(() => {
			const tickets = this.tickets();
			untracked(() => this.selectedPickingTicket.set(this._reconcile(this.selectedPickingTicket(), tickets)));
		});

		effect(() => {
			const ticketItems = this.ticketItems();
			untracked(() => this.selectedPickingTicketItem.set(this._reconcile(this.selectedPickingTicketItem(), ticketItems)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			pickingPlans: this.pickingPlanApi.load(),
			pickingPlanItems: this.pickingPlanItemApi.load(),
			pickingPlanItemSources: this.pickingPlanItemSourceApi.load(),
			pickingPlanSources: this.pickingPlanSourceApi.load(),
			pickingTickets: this.pickingTicketApi.load(),
			pickingTicketItems: this.pickingTicketItemApi.load(),

			warehouses: this.warehouseApi.load(),
			users: this.userApi.load(),
			locations: this.locationApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
			goodsIssues: this.goodsIssueApi.load(),
			goodsIssueDetails: this.goodsIssueDetailApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('productGroup.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	readonly pickingPlanItems = signal<PickingPlanItemDto[]>([]);
	readonly pickingPlanSources = signal<PickingPlanSourceDto[]>([]);
	readonly pickingTickets = signal<PickingTicketDto[]>([]);

	_pickingPlanItemUId = -1;

	activeTab = 'sources';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('pickingPlan.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), planNo: this._nextPlanNo() };
		// A receipt with no line is meaningless, so start the operator on one.
		this.pickingPlanSources.set([this._emptyPickingPlanSource()]);
		// this.pickingPlanItems.set([this._emptyPickingPlanItem()]);
		this.pickingTickets.set([this._emptyPickingTicket()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPickingPlan();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			planNo: row.planNo,
			warehouseId: row.warehouseId ?? null,
			status: row.status,
			remark: row.remark ?? null,
		};

		this.pickingPlanSources.set(
			this.pickingPlanSourceApi.items()
				.filter(source => source.pickingPlanId === row.id)
				.map(source => ({
					...source
				}))
		);

		this.pickingPlanItems.set(
			this.pickingPlanItemApi.items()
				.filter(item => item.pickingPlanId === row.id)
				.map(item => ({
					...item,
					uId: item.id ?? this._pickingPlanItemUId--,
					pickingPlanItemSources: this.pickingPlanItemSourceApi.items()
						.filter(source => source.pickingPlanItemId === item.id)
						.map(source => ({ ...source }))
				}))
		);

		// console.log('this.pickingPlanItems:', this.pickingPlanItems());

		this.pickingTickets.set(
			this.pickingTicketApi.items()
				.filter(ticket => ticket.pickingPlanId === row.id)
				.map(ticket => ({
					...ticket,
					pickingTicketItems: this.pickingTicketItemApi.items()
						.filter(item => item.pickingTicketId === ticket.id)
						.map(item => ({ ...item }))
				}))
		);

		// console.log('this.pickingTickets:', this.pickingTickets());

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
		this._savePlan(id).subscribe({
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
		const row = this.selectedPickingPlan();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('pickingPlan.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.planNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.pickingPlanApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.planNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('pickingPlan.lower') }), err),
			}),
		});
	}

	// ─── source grid ──────────────────────────────────────────────────────────────
	addPickingPlanSource(): void {
		this.pickingPlanSources.update(rows => [...rows, this._emptyPickingPlanSource()]);
	}

	removePickingPlanSourceRow(row: PickingPlanSourceDto): void {
		this.pickingPlanSources.update(rows => rows.filter(r => r !== row));
	}

	onSourceChange(row: PickingPlanSourceDto, sourceId: number | null): void {
		row.sourceId = sourceId ?? 0;
		const source = this.goodsIssueApi.items().find(p => p.id === sourceId);
		row.sourceNo = source?.issueNo ?? row.sourceNo;

		if (source) {
			const details = this.goodsIssueDetailApi
				.items()
				.filter(d => d.goodsIssueId === source.id);

			this.pickingPlanItems.update(rows => {
				const result = [...rows];

				for (const detail of details) {
					if (!detail.productId) {
						continue;
					}

					const existing = result.find(
						x => x.productId === detail.productId
					);

					const qty = detail.quantity ?? 0;

					if (existing) {
						existing.requiredQty = (existing.requiredQty ?? 0) + qty;
						existing.allocatedQty = (existing.allocatedQty ?? 0) + qty;
						existing.remainingQty = (existing.remainingQty ?? 0) + qty;
					} else {
						result.push({
							id: 0,
							productId: detail.productId,
							unitId: detail.unitId,
							requiredQty: qty,
							allocatedQty: qty,
							pickedQty: 0,
							remainingQty: qty,
							status: 1,
							remark: null,
							pickingPlanItemSources: [this._emptyPickingPlanItemSource()],
							uId: this._pickingPlanItemUId--,
						});
					}
				}

				return result;
			});

			// console.log('this.pickingPlanItems():', this.pickingPlanItems());
		}
	}

	// ─── item grid ──────────────────────────────────────────────────────────────
	addPickingPlanItem(): void {
		this.pickingPlanItems.update(rows => [...rows, this._emptyPickingPlanItem()]);
		console.log('this.pickingPlanItems():', this.pickingPlanItems());
	}

	removePickingPlanItem(row: PickingPlanItemDto): void {
		this.pickingPlanItems.update(rows => rows.filter(r => r !== row));
	}

	// ─── item source grid ──────────────────────────────────────────────────────────────
	addPickingPlanItemSource(item: PickingPlanItemDto): void {
		this.pickingPlanItems.update(rows =>
			rows.map(b => b === item ? { ...b, pickingPlanItemSources: [...b.pickingPlanItemSources, this._emptyPickingPlanItemSource()] } : b)
		);
	}

	removePickingPlanItemSource(item: PickingPlanItemDto, row: PickingPlanItemSourceDto): void {
		this.pickingPlanItems.update(rows =>
			rows.map(b => b === item ? { ...b, pickingPlanItemSources: b.pickingPlanItemSources.filter(d => d !== row) } : b)
		);
	}

	onSourceDetailChange(row: PickingPlanItemSourceDto, sourceDetailId: number | null): void {
		const sourceDetail = this.goodsIssueDetailApi.items().find(p => p.id === sourceDetailId);
		// console.log('sourceDetail?.quantity:', sourceDetail);
		row.requiredQty = sourceDetail?.quantity ?? row.requiredQty;
	}

	// ─── ticket grid ──────────────────────────────────────────────────────────────
	addPickingTicket(): void {
		this.pickingTickets.update(rows => [...rows, this._emptyPickingTicket()]);
	}

	removePickingTicket(row: PickingTicketDto): void {
		this.pickingTickets.update(rows => rows.filter(r => r !== row));
	}

	// ─── item source grid ──────────────────────────────────────────────────────────────
	addPickingTicketItem(ticket: PickingTicketDto): void {
		console.log('pickingPlanItems:', this.pickingPlanItems());
		this.pickingTickets.update(rows =>
			rows.map(b => b === ticket ? { ...b, pickingTicketItems: [...b.pickingTicketItems, this._emptyPickingTicketItem()] } : b)
		);
	}

	removePickingTicketItem(ticket: PickingTicketDto, row: PickingTicketItemDto): void {
		this.pickingTickets.update(rows =>
			rows.map(b => b === ticket ? { ...b, pickingTicketItems: b.pickingTicketItems.filter(d => d !== row) } : b)
		);
	}

	onPickingTicketItemChange(ticket: PickingTicketItemDto, pickingPlanItemId: number | null): void {
		const pickingPlanItem = this.pickingPlanItems().find(p => p.uId === pickingPlanItemId);
		// console.log('pickingPlanItem:', pickingPlanItem);
		ticket.productId = pickingPlanItem?.productId ?? ticket.productId;
		ticket.requestedQty = pickingPlanItem?.requiredQty ?? ticket.requestedQty;

	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			// id: 0,
			planNo: '',
			warehouseId: null as number | null,
			status: 1,
			remark: null as string | null,
		};
	}

	private _emptyPickingPlanItem(): PickingPlanItemDto {
		return {
			id: 0,
			pickingPlanId: 0,
			productId: null as number | null,
			unitId: null as number | null,
			requiredQty: null as number | null,
			allocatedQty: null as number | null,
			pickedQty: null as number | null,
			remainingQty: null as number | null,
			status: 1,
			remark: null as string | null,

			pickingPlanItemSources: [this._emptyPickingPlanItemSource()],
			uId: this._pickingPlanItemUId--,
		};
	}

	private _emptyPickingPlanItemSource(): PickingPlanItemSourceDto {
		return {
			id: 0,
			pickingPlanItemId: 0,
			sourceId: null as number | null,
			sourceDetailId: null as number | null,
			requiredQty: null as number | null,
			pickedQty: null as number | null,
		};
	}

	private _emptyPickingPlanSource(): PickingPlanSourceDto {
		return {
			id: 0,
			sourceType: null as number | null,
			sourceId: null as number | null,
			sourceNo: null as string | null,
		};
	}

	private _emptyPickingTicket(): PickingTicketDto {
		return {
			id: 0,
			ticketNo: this._nextTicketNo(),
			pickingPlanId: 0,
			warehouseId: null as number | null,
			status: 1,
			assignedTo: null as number | null,
			startedAt: null as string | null,
			completedAt: null as string | null,
			remark: null as string | null,

			pickingTicketItems: [this._emptyPickingTicketItem()],
		};
	}

	private _emptyPickingTicketItem(): PickingTicketItemDto {
		return {
			id: 0,
			pickingTicketId: 0,
			pickingPlanItemId: 0,
			productId: null as number | null,
			locationId: null as number | null,
			lotId: null as number | null,
			serialNo: null as string | null,
			requestedQty: null as number | null,
			pickedQty: null as number | null,
			status: 1,
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

	private _savePlan(id: number | null): Observable<PickingPlanDto> {
		const body: PickingPlanRequest = {
			planNo: this.form.planNo.trim(),
			warehouseId: this.form.warehouseId,
			status: this.form.status,
			remark: this.form.remark,
			pickingPlanItems: this.pickingPlanItems().map(item => ({
				id: item.id > 0 ? item.id : 0,
				productId: item.productId,
				unitId: item.unitId,
				requiredQty: item.requiredQty,
				allocatedQty: item.allocatedQty,
				pickedQty: item.pickedQty,
				remainingQty: item.remainingQty,
				status: item.status,
				remark: item.remark,
				uId: item.uId,
				pickingPlanItemSources: item.pickingPlanItemSources.map((source) => ({
					id: source.id > 0 ? source.id : 0,
					sourceId: source.sourceId,
					sourceDetailId: source.sourceDetailId,
					requiredQty: source.requiredQty,
					pickedQty: source.pickedQty,
				})),
			})),

			pickingPlanSources: this.pickingPlanSources().map((source: PickingPlanSourceDto) => ({
				id: source.id > 0 ? source.id : 0,
				pickingPlanId: source.pickingPlanId,
				sourceType: source.sourceType,
				sourceId: source.sourceId,
				sourceNo: source.sourceNo,
			})),

			pickingTickets: this.pickingTickets().map((ticket: PickingTicketDto) => ({
				id: ticket.id > 0 ? ticket.id : 0,
				ticketNo: ticket.ticketNo,
				warehouseId: ticket.warehouseId,
				status: ticket.status,
				assignedTo: ticket.assignedTo,
				startedAt: ticket.startedAt,
				completedAt: ticket.completedAt,
				remark: ticket.remark,
				pickingTicketItems: ticket.pickingTicketItems.map((item) => ({
					id: item.id > 0 ? item.id : 0,
					pickingPlanItemId: item.pickingPlanItemId,
					productId: item.productId,
					locationId: item.locationId,
					lotId: item.lotId,
					serialNo: item.serialNo,
					requestedQty: item.requestedQty,
					pickedQty: item.pickedQty,
					status: item.status,
					remark: item.remark,
				})),
			})),
		};
		console.log('body:', body);
		return id ? this.pickingPlanApi.update(id, body) : this.pickingPlanApi.create(body);
	}


	private _nextPlanNo(): string {
		const prefix = 'PP';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.plans().filter(r => r.planNo.startsWith(prefixWithDate));

		let stt = 1;

		if (existing.length > 0) {
			const numbers = existing
				.map(r => {
					const match = r.planNo.match(
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

	_ticketNo: string[] = [];
	private _nextTicketNo(): string {
		const prefix = 'PT';

		const datePart = formatDate(new Date(), 'yyyyMMdd', 'en-US');
		const prefixWithDate = `${prefix}_${datePart}_`;

		const existing = this.tickets().filter(r =>
			r.ticketNo.startsWith(prefixWithDate),
		);

		this._ticketNo.push(...existing.map(r => r.ticketNo));

		let stt = 1;

		if (this._ticketNo.length > 0) {
			const numbers = this._ticketNo
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

		let ticketNo = `${prefixWithDate}${String(stt).padStart(3, '0')}`
		this._ticketNo.push(ticketNo);
		return ticketNo;
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
