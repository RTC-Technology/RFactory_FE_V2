import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
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
import { PICKING_PLAN_ITEM_STATUSES, PICKING_PLAN_STATUSES, PICKING_TICKET_ITEM_STATUSES, PICKING_TICKET_STATUSES, PickingPlanDto, PickingPlanItemDto, PickingPlanItemSourceDto, PickingPlanSourceDto, PickingTicketDto, PickingTicketItemDto } from '../../domain/models/picking-plan.model';
import { forkJoin } from 'rxjs';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { WarehouseApiService, WarehouseLocationApiService } from '../../core/services/warehouse-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { UserGroupApiService } from '../../core/services/user-group-api.service';
import { GoodsIssueApiService, GoodsIssueDetailApiService } from '../../core/services/goods-issue-api.service';

type EntityKind = 'pickingPlan';

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

	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly locationApi = inject(WarehouseLocationApiService);
	private readonly userGroupApi = inject(UserGroupApiService);
	private readonly goodsIssueApi = inject(GoodsIssueApiService);
	private readonly goodsIssueDetailApi = inject(GoodsIssueDetailApiService);


	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);


	// ─── Lookups ────────────────────────────────────────────────────────────────

	// pickingPlanTypeLabel(id?: number | null): string {
	// 	return this.typeApi.items().find(t => t.id === id)?.productTypeName ?? '';
	// }

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(u => ({ label: `${u.warehouseCode} · ${u.warehouseName}`, value: u.id })));

	readonly statusOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly sourceTypeOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly sourceOptions = computed(() =>
		this.goodsIssueApi.items().map(u => ({ label: `${u.issueNo}`, value: u.id })));

	readonly productOptions = computed(() =>
		this.productApi.items().map(u => ({ label: `${u.productCode} · ${u.productName}`, value: u.id })));

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	readonly itemStatusOptions = computed(() =>
		PICKING_PLAN_ITEM_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly sourceDetailOptions = computed(() =>
		this.goodsIssueDetailApi.items().map(u => ({ label: `${u.productId} · ${u.quantity}`, value: u.id })));

	readonly ticketStatusOptions = computed(() =>
		PICKING_TICKET_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly userOptions = computed(() =>
		this.userGroupApi.items().map(u => ({ label: `${u.code} · ${u.name}`, value: u.id })));

	readonly planItemOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly locationOptions = computed(() =>
		this.locationApi.items().map(u => ({ label: `${u.warehouseLocationCode} · ${u.warehouseLocationName}`, value: u.id })));

	readonly lotOptions = computed(() =>
		PICKING_PLAN_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	readonly ticketItemStatusOptions = computed(() =>
		PICKING_TICKET_ITEM_STATUSES.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────

	readonly selectedPickingPlan = signal<PickingPlanDto | null>(null);

	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly pickingPlanTable = viewChild<Table>('pickingPlanTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		pickingPlan: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = { pickingPlan: this.pickingPlanTable() }[kind];
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

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super();
		// effect(() => {
		// 	const pickingPlans = this.pickingPlans();
		// 	untracked(() => this.selectedPickingPlan.set(this._reconcile(this.selectedPickingPlan(), pickingPlans)));
		// });
		// effect(() => {
		// 	const sources = this.sources();
		// 	untracked(() => this.selectedSource.set(this._reconcile(this.selectedSource(), sources)));
		// });
		// effect(() => {
		// 	const items = this.items(this.selectedSource());
		// 	untracked(() => this.selectedRouting.set(this._reconcile(this.selectedRouting(), routings)));
		// });
		// effect(() => {
		// 	const ops = this.routingOps(this.selectedRouting());
		// 	untracked(() => this.selectedRoutingOp.set(this._reconcile(this.selectedRoutingOp(), ops)));
		// });
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			warehouses: this.warehouseApi.load(),
			users: this.userGroupApi.load(),
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

	activeTab = 'sources';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('pickingPlan.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };
		// A receipt with no line is meaningless, so start the operator on one.
		this.pickingPlanSources.set([this._emptyPickingPlanSource()]);
		this.pickingPlanItems.set([this._emptyPickingPlanItem()]);
		this.pickingTickets.set([this._emptyPickingTicket()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		// const row = this.selectedGroup();
		// if (!row) return;
		// this.editingId.set(row.id);
		// this.formError.set('');

		// this.form = {
		// 	id: row.id,
		// 	groupNo: row.groupNo ?? '',
		// 	groupName: row.groupName ?? '',
		// 	parentId: row.parentId ?? 0
		// };

		// this.dialogOpen.set(true);
	}

	save(): void {
		// const error = this._validate();
		// if (error) {
		// 	this.formError.set(error);
		// 	return;
		// }

		// this.saving.set(true);
		// this.formError.set('');

		// const id = this.editingId();

		// // One call carrying the header and every line: the backend writes them in a single
		// // transaction, so a rejected line cannot leave a receipt behind.
		// this._saveGroup(id).subscribe({
		// 	next: () => {
		// 		this.saving.set(false);
		// 		this.dialogOpen.set(false);
		// 		this.reload();
		// 		this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
		// 			entity: this.i18n.t('productGroup.lower'),
		// 		}));
		// 	},
		// 	error: (err: HttpErrorResponse) => {
		// 		this.saving.set(false);
		// 		this.formError.set(err.error?.message
		// 			|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('productGroup.lower') }));
		// 	},
		// });
	}

	askDelete(): void {
		// const row = this.selectedGroup();
		// if (!row) return;

		// // this.confirm.confirm({
		// this.confirm.confirm({
		// 	header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('productGroup.lower') }),
		// 	message: `${this.i18n.t('plant.confirm.message', { label: row.groupNo })} ${this.i18n.t('common.notUndoable')}`,
		// 	acceptLabel: this.i18n.t('common.delete'),
		// 	rejectLabel: this.i18n.t('common.cancel'),
		// 	acceptButtonStyleClass: 'p-button-danger',
		// 	rejectButtonStyleClass: 'p-button-text',
		// 	// The backend owns the "still used by products" rule and returns its own message.
		// 	accept: () => this.groupApi.remove(row.id).subscribe({
		// 		next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.groupNo })); },
		// 		error: (err: HttpErrorResponse) =>
		// 			this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('productGroup.lower') }), err),
		// 	}),
		// });
	}

	// ─── source grid ──────────────────────────────────────────────────────────────
	addPickingPlanSource(): void {
		this.pickingPlanSources.update(rows => [...rows, this._emptyPickingPlanSource()]);
	}

	removePickingPlanSourceRow(row: PickingPlanSourceDto): void {
		this.pickingPlanSources.update(rows => rows.filter(r => r !== row));
	}

	// ─── item grid ──────────────────────────────────────────────────────────────
	addPickingPlanItem(): void {
		this.pickingPlanItems.update(rows => [...rows, this._emptyPickingPlanItem()]);
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

	// ─── ticket grid ──────────────────────────────────────────────────────────────
	addPickingTicket(): void {
		this.pickingTickets.update(rows => [...rows, this._emptyPickingTicket()]);
	}

	removePickingTicket(row: PickingTicketDto): void {
		this.pickingTickets.update(rows => rows.filter(r => r !== row));
	}

	// ─── item source grid ──────────────────────────────────────────────────────────────
	addPickingTicketItem(ticket: PickingTicketDto): void {
		this.pickingTickets.update(rows =>
			rows.map(b => b === ticket ? { ...b, pickingTicketItems: [...b.pickingTicketItems, this._emptyPickingTicketItem()] } : b)
		);
	}

	removePickingTicketItem(ticket: PickingTicketDto, row: PickingTicketItemDto): void {
		this.pickingTickets.update(rows =>
			rows.map(b => b === ticket ? { ...b, pickingTicketItems: b.pickingTicketItems.filter(d => d !== row) } : b)
		);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm(): PickingPlanDto {
		return {
			id: 0,
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
			ticketNo: '',
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

	// private _saveGroup(id: number | null): Observable<ProductGroupDto> {
	// 	const body: ProductGroupRequest = {
	// 		groupNo: this.form.groupNo.trim(),
	// 		groupName: this.form.groupName.trim(),
	// 		parentId: this.form.parentId,
	// 	};
	// 	return id ? this.groupApi.update(id, body) : this.groupApi.create(body);
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
