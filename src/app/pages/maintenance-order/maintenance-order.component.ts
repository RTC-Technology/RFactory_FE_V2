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
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { FailureCodeApiService, MaintenanceChecklistApiService, MaintenanceChecklistItemApiService, MaintenanceOrderApiService, MaintenanceOrderChecklistApiService, MaintenanceOrderChecklistItemApiService, MaintenancePlanApiService, MaintenanceTypeApiService } from '../../core/services/master-data-api.service';
import { MachineApiService } from '../../core/services/equipment-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { UnitApiService } from '../../core/services/product-api.service';
import { MAINTENANCE_ORDER_CHECKLIST_ITEM_RESULT, MAINTENANCE_ORDER_CHECKLIST_ITEM_TYPE, MAINTENANCE_ORDER_CHECKLIST_STATUS, MAINTENANCE_ORDER_PRIORITY, MAINTENANCE_ORDER_STATUS, MaintenanceChecklistItemDto, MaintenanceOrderChecklistDto, MaintenanceOrderChecklistItemDto, maintenanceOrderChecklistItemResultOf, maintenanceOrderChecklistStatusOf, MaintenanceOrderDto, maintenanceOrderPriorityOf, MaintenanceOrderRequest, maintenanceOrderStatusOf, MaintenancePlanDto } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserApiService } from '../../core/services/organization-api.service';
import { TabsModule } from 'primeng/tabs';
import { PanelModule } from 'primeng/panel';

type EntityKind = 'maintenanceOrder' | 'maintenanceOrderChecklist' | 'maintenanceOrderChecklistItem';
const DATETIME_LOCAL = "yyyy-MM-dd";

@Component({
	selector: 'app-maintenance-order',
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
		ToggleButtonModule,
		CheckboxModule,
		TabsModule,
		PanelModule,
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './maintenance-order.component.html',
	styleUrl: './maintenance-order.component.scss',
})
export class MaintenanceOrderComponent extends PermissionAwarePage implements OnInit {
	readonly _maintenancePlanDto = input<MaintenancePlanDto | null>(null);

	readonly maintenanceOrderApi = inject(MaintenanceOrderApiService);
	readonly maintenanceOrderChecklistApi = inject(MaintenanceOrderChecklistApiService);
	readonly maintenanceOrderChecklistItemApi = inject(MaintenanceOrderChecklistItemApiService);

	readonly maintenancePlanApi = inject(MaintenancePlanApiService);
	readonly maintenanceTypeApi = inject(MaintenanceTypeApiService);
	readonly machineApi = inject(MachineApiService);
	readonly employeeApi = inject(UserApiService);

	readonly maintenanceChecklistApi = inject(MaintenanceChecklistApiService);
	readonly maintenanceChecklistItemApi = inject(MaintenanceChecklistItemApiService);
	readonly unitApi = inject(UnitApiService);
	readonly failureCodeApi = inject(FailureCodeApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	prioritySeverity = maintenanceOrderPriorityOf;
	statusSeverity = maintenanceOrderStatusOf;
	checklistStatusSeverity = maintenanceOrderChecklistStatusOf;
	checklistResultSeverity = maintenanceOrderChecklistItemResultOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────
	maintenancePlanLabel(id?: number | null): string {
		if (id == null) return '';
		const plan = this.maintenancePlanApi.items().find(u => u.id === id);
		return plan ? `${plan.planCode} · ${plan.planName}` : '';
	}

	maintenanceTypeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = this.maintenanceTypeApi.items().find(u => u.id === id);
		return type ? `${type.typeCode} · ${type.typeName}` : '';
	}

	machineLabel(id?: number | null): string {
		if (id == null) return '';
		const machine = this.machineApi.items().find(u => u.id === id);
		return machine ? `${machine.machineCode} · ${machine.machineName}` : '';
	}

	employeeLabel(id?: number | null): string {
		if (id == null) return '';
		const employee = this.employeeApi.items().find(u => u.id === id);
		return employee ? `${employee.code} · ${employee.fullName}` : '';
	}

	maintenanceChecklistLabel(id?: number | null): string {
		if (id == null) return '';
		const checklist = this.maintenanceChecklistApi.items().find(u => u.id === id);
		return checklist ? `${checklist.checklistCode} · ${checklist.checklistName}` : '';
	}

	maintenanceChecklistItemLabel(id?: number | null): string {
		if (id == null) return '';
		const checklistitem = this.maintenanceChecklistItemApi.items().find(u => u.id === id);
		return checklistitem ? `${checklistitem.itemCode} · ${checklistitem.itemName}` : '';
	}

	unitLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? `${unit.unitCode} · ${unit.unitName}` : '';
	}

	failureCodeLabel(id?: number | null): string {
		if (id == null) return '';
		const failurecode = this.failureCodeApi.items().find(u => u.id === id);
		return failurecode ? `${failurecode.code} · ${failurecode.name}` : '';
	}

	priorityLabel(value?: number | null): string {
		if (value == null) return '';
		const priority = MAINTENANCE_ORDER_PRIORITY.find(u => u.value === value);
		return priority ? this.i18n.t(priority.labelKey) : '';
	}

	statusLabel(value?: number | null): string {
		if (value == null) return '';
		const status = MAINTENANCE_ORDER_STATUS.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	checklistStatusLabel(value?: number | null): string {
		if (value == null) return '';
		const status = MAINTENANCE_ORDER_CHECKLIST_STATUS.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	itemCheckTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const status = MAINTENANCE_ORDER_CHECKLIST_ITEM_TYPE.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	resultLabel(value?: number | null): string {
		if (value == null) return '';
		const status = MAINTENANCE_ORDER_CHECKLIST_ITEM_RESULT.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	readonly maintenancePlanOptions = computed(() =>
		this.maintenancePlanApi.items().map(u => ({ label: `${u.planCode} · ${u.planName}`, value: u.id })));

	readonly maintenanceTypeOptions = computed(() =>
		this.maintenanceTypeApi.items().map(u => ({ label: `${u.typeCode} · ${u.typeName}`, value: u.id })));

	readonly machineOptions = computed(() =>
		this.machineApi.items().map(u => ({ label: `${u.machineCode} · ${u.machineName}`, value: u.id })));

	readonly employeeOptions = computed(() =>
		this.employeeApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly maintenanceChecklistOptions = computed(() =>
		this.maintenanceChecklistApi.items().map(u => ({ label: `${u.checklistCode} · ${u.checklistName}`, value: u.id })));

	// readonly maintenanceChecklistItemOptions = computed(() =>
	// 	this.maintenanceChecklistItemApi.items().map(u => ({ label: `${u.itemCode} · ${u.itemName}`, value: u.id })));

	readonly maintenanceChecklistItemOptions = (checklistId?: number | null): { label: string; value: number }[] => {
		const items = this.maintenanceChecklistItemApi.items();
		const list = checklistId != null ? items.filter(x => x.maintenanceChecklistId == checklistId) : items;
		return list.map(u => ({ label: `${u.itemCode} · ${u.itemName}`, value: u.id }));
	};

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	readonly failureCodeOptions = computed(() =>
		this.failureCodeApi.items().map(u => ({ label: `${u.code} · ${u.name}`, value: u.id })));

	readonly priorityOptions = computed(() =>
		MAINTENANCE_ORDER_PRIORITY.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		MAINTENANCE_ORDER_STATUS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly checklistStatusOptions = computed(() =>
		MAINTENANCE_ORDER_CHECKLIST_STATUS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly itemCheckTypeOptions = computed(() =>
		MAINTENANCE_ORDER_CHECKLIST_ITEM_TYPE.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly resultOptions = computed(() =>
		MAINTENANCE_ORDER_CHECKLIST_ITEM_RESULT.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedOrder = signal<MaintenanceOrderDto | null>(null);
	readonly selectedChecklist = signal<MaintenanceOrderChecklistDto | null>(null);
	readonly selectedItem = signal<MaintenanceOrderChecklistItemDto | null>(null);

	readonly maintenanceOrders = computed(() => {
		const all = this.maintenanceOrderApi.items();
		const id = this._maintenancePlanDto()?.id;
		if (id) return all.filter(r => r.maintenancePlanId === id);
		return all;
	});
	readonly maintenanceOrderChecklists = computed(() => {
		const id = this.selectedOrder()?.id;
		if (id == null) return [];
		const all = this.maintenanceOrderChecklistApi.items().filter(r => r.maintenanceOrderId === id);
		return all;
	});

	readonly maintenanceOrderChecklistItems = computed(() => {
		const id = this.selectedChecklist()?.id;
		if (id == null) return [];
		const all = this.maintenanceOrderChecklistItemApi.items().filter(r => r.maintenanceOrderChecklistId === id);
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly orderTable = viewChild<Table>('orderTable');
	private readonly checklistTable = viewChild<Table>('checklistTable');
	private readonly itemTable = viewChild<Table>('itemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		maintenanceOrder: [''],
		maintenanceOrderChecklist: [''],
		maintenanceOrderChecklistItem: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			maintenanceOrder: this.orderTable(),
			maintenanceOrderChecklist: this.checklistTable(),
			maintenanceOrderChecklistItem: this.itemTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'maintenanceOrder') {
			this.selectedOrder.set(this._reconcile(this.selectedOrder(), visible as MaintenanceOrderDto[]));
		} else if (kind === 'maintenanceOrderChecklist') {
			this.selectedChecklist.set(this._reconcile(this.selectedChecklist(), visible as MaintenanceOrderChecklistDto[]));
		} else if (kind === 'maintenanceOrderChecklistItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as MaintenanceOrderChecklistItemDto[]));
		}
	}

	selectOrder(order: MaintenanceOrderDto): void {
		if (this.selectedOrder()?.id === order.id) return;
		this.selectedOrder.set(order);
	}
	selectChecklist(checklist: MaintenanceOrderChecklistDto): void {
		if (this.selectedChecklist()?.id === checklist.id) return;
		this.selectedChecklist.set(checklist);
	}
	selectItem(item: MaintenanceOrderChecklistItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.maintenanceOrder);

		effect(() => {
			const orders = this.maintenanceOrders();
			untracked(() => this.selectedOrder.set(this._reconcile(this.selectedOrder(), orders)));
		});

		effect(() => {
			const checklists = this.maintenanceOrderChecklists();
			untracked(() => this.selectedChecklist.set(this._reconcile(this.selectedChecklist(), checklists)));
		});

		effect(() => {
			const items = this.maintenanceOrderChecklistItems();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});

	}

	ngOnInit(): void {
		this.reload();

	}

	ngAfterViewInit(): void {

		if (this._maintenancePlanDto()?.id) this.openCreate();
	}

	reload(): void {
		forkJoin({
			maintenanceOrders: this.maintenanceOrderApi.load(),
			maintenanceOrderChecklists: this.maintenanceOrderChecklistApi.load(),
			maintenanceOrderChecklistItems: this.maintenanceOrderChecklistItemApi.load(),

			maintenancePlans: this.maintenancePlanApi.load(),
			maintenanceTypes: this.maintenanceTypeApi.load(),

			machines: this.machineApi.load(),
			employees: this.employeeApi.load(),
			maintenanceChecklists: this.maintenanceChecklistApi.load(),
			maintenanceChecklistItems: this.maintenanceChecklistItemApi.load(),
			units: this.unitApi.load(),
			failureCodes: this.failureCodeApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('maintenanceOrder.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly checklistRows = signal<MaintenanceOrderChecklistDto[]>([]);
	private _tempItemId = 0;

	activeTab = 'order';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('maintenanceOrder.lower'),
		}));

	openCreate(): void {

		console.log('maintenancePlanDto', this._maintenancePlanDto());

		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), orderNo: this._nextOrderNo() };
		this.checklistRows.set([this._emptyChecklistRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedOrder();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			orderNo: row.orderNo,
			maintenancePlanId: row.maintenancePlanId ?? null,
			maintenanceTypeId: row.maintenanceTypeId,
			machineId: row.machineId,
			priority: row.priority,
			status: row.status,
			plannedStartDate: this._toLocalInput(row.plannedStartDate),
			plannedEndDate: this._toLocalInput(row.plannedEndDate),
			actualStartDate: this._toLocalInput(row.actualStartDate),
			actualEndDate: this._toLocalInput(row.actualEndDate),
			responsibleEmployeeId: row.responsibleEmployeeId ?? null,
			description: row.description ?? null,
			completionNote: row.completionNote ?? null,
			remark: row.remark ?? null,
		};

		this.checklistRows.set(
			this.maintenanceOrderChecklistApi.items()
				.filter(d => d.maintenanceOrderId === row.id)
				.map(d => ({
					...d,
					startedDate: this._toLocalInput(d.startedDate),
					completedDate: this._toLocalInput(d.completedDate),
					maintenanceOrderChecklistItems: this.maintenanceOrderChecklistItemApi.items()
						.filter(i => i.maintenanceOrderChecklistId === d.id)
						.map(i => ({
							...i,
							completedDate: this._toLocalInput(i.completedDate),
						}))
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
		this._saveRule(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('maintenanceOrder.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('maintenanceOrder.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedOrder();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('maintenanceOrder.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.orderNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.maintenanceOrderApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.orderNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('maintenanceOrder.lower') }), err),
			}),
		});
	}

	onMaintenancePlanChange(planId: number | null): void {
		const maintenancePlan = this.maintenancePlanApi.items().find(m => m.id === planId);

		this.form.maintenanceTypeId = maintenancePlan?.maintenanceTypeId ?? this.form.maintenanceTypeId;
		this.form.machineId = maintenancePlan?.machineId ?? this.form.machineId;
		this.form.priority = maintenancePlan?.priority ?? this.form.priority;
		this.form.plannedStartDate = maintenancePlan?.startDate ? formatDate(maintenancePlan?.startDate ?? '', DATETIME_LOCAL, 'en-US') : this.form.plannedStartDate;
		this.form.plannedEndDate = maintenancePlan?.endDate ? formatDate(maintenancePlan?.endDate ?? '', DATETIME_LOCAL, 'en-US') : this.form.plannedEndDate;
		this.form.responsibleEmployeeId = maintenancePlan?.responsibleEmployeeId ?? this.form.responsibleEmployeeId;
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addChecklist(): void {
		this.checklistRows.update(rows => [...rows, this._emptyChecklistRow()]);
	}

	removeChecklist(row: MaintenanceOrderChecklistDto): void {
		this.checklistRows.update(rows => rows.filter(r => r !== row));
	}

	onMaintenanceChecklistChange(checklistId: number | null, check: MaintenanceOrderChecklistDto): void {
		const maintenanceChecklist = this.maintenanceChecklistApi.items().find(m => m.id === checklistId);

		check.checklistCode = maintenanceChecklist?.checklistCode ?? "";
		check.checklistName = maintenanceChecklist?.checklistName ?? "";
		check.checklistVersion = maintenanceChecklist?.version ?? null;

		if (this.editingId() != null && check.maintenanceOrderChecklistItems?.length > 0) return;
		const items = this.maintenanceChecklistItemApi.items()
			.filter(x => x.maintenanceChecklistId == checklistId)
			.map(x => ({
				...this._emptyChecklistItemRow(),
				maintenanceChecklistItemId: x.id,
				itemCode: x.itemCode ?? "",
				itemName: x.itemName ?? "",
				checkType: x.checkType ?? 1,
				unitId: x.unitId ?? null,
				targetValue: x.targetValue ?? null,
				minValue: x.minValue ?? null,
				maxValue: x.maxValue ?? null,
				expectedResult: x.expectedResult ?? null,
				isRequired: x.isRequired ?? false,
			}));

		check.maintenanceOrderChecklistItems = items;
	}

	addChecklistItem(checklistRow: MaintenanceOrderChecklistDto): void {
		this.checklistRows.update(rows =>
			rows.map(r => r === checklistRow ? { ...r, maintenanceOrderChecklistItems: [...r.maintenanceOrderChecklistItems, this._emptyChecklistItemRow()] } : r)
		);
	}

	removeChecklistItem(checklistRow: MaintenanceOrderChecklistDto, row: MaintenanceOrderChecklistItemDto): void {
		this.checklistRows.update(rows =>
			rows.map(p => p === checklistRow ? { ...p, maintenanceOrderChecklistItems: p.maintenanceOrderChecklistItems.filter(d => d !== row) } : p)
		);
	}


	onMaintenanceChecklistItemChange(maintenanceChecklistItemId: number | null, row: MaintenanceOrderChecklistItemDto): void {
		const maintenanceChecklistItem = this.maintenanceChecklistItemApi.items().find(m => m.id === maintenanceChecklistItemId);

		row.itemCode = maintenanceChecklistItem?.itemCode ?? row.itemCode;
		row.itemName = maintenanceChecklistItem?.itemName ?? row.itemName;
		row.checkType = maintenanceChecklistItem?.checkType ?? row.checkType;
		row.unitId = maintenanceChecklistItem?.unitId ?? row.unitId;
		row.targetValue = maintenanceChecklistItem?.targetValue ?? row.targetValue;
		row.minValue = maintenanceChecklistItem?.minValue ?? row.minValue;
		row.maxValue = maintenanceChecklistItem?.maxValue ?? row.maxValue;
		row.expectedResult = maintenanceChecklistItem?.expectedResult ?? row.expectedResult;
		row.isRequired = maintenanceChecklistItem?.isRequired ?? row.isRequired;
	}
	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			orderNo: "",
			maintenancePlanId: this._maintenancePlanDto()?.id as number | null,
			maintenanceTypeId: this._maintenancePlanDto()?.maintenanceTypeId ?? 0,
			machineId: this._maintenancePlanDto()?.machineId ?? 0,
			priority: this._maintenancePlanDto()?.priority ?? 1,
			status: 1,
			plannedStartDate: formatDate(this._maintenancePlanDto()?.startDate ?? new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			plannedEndDate: this._maintenancePlanDto()?.endDate ? formatDate(this._maintenancePlanDto()?.endDate ?? '', DATETIME_LOCAL, 'en-US') : null as string | null,
			actualStartDate: null as string | null,
			actualEndDate: null as string | null,
			responsibleEmployeeId: this._maintenancePlanDto()?.responsibleEmployeeId as number | null,
			description: null as string | null,
			completionNote: null as string | null,
			remark: null as string | null,
		};
	}

	private _emptyChecklistRow() {

		const maintenanceChecklist = this.maintenanceChecklistApi.items().find(x => x.id == this._maintenancePlanDto()?.maintenanceChecklistId);
		const maintenanceChecklistItem = this.maintenanceChecklistItemApi.items().filter(x => x.maintenanceChecklistId == maintenanceChecklist?.id);
		return {
			id: this._tempItemId--,
			maintenanceOrderId: null as number | null,
			maintenanceChecklistId: maintenanceChecklist?.id as number | null,
			checklistCode: maintenanceChecklist?.checklistCode ?? "",
			checklistName: maintenanceChecklist?.checklistName ?? "",
			checklistVersion: maintenanceChecklist?.version as number | null,
			status: 1,
			startedDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			completedDate: null as string | null,
			completedBy: null as number | null,
			remark: null as string | null,
			maintenanceOrderChecklistItems: maintenanceChecklistItem.map(item => ({
				...this._emptyChecklistItemRow(),
				maintenanceChecklistItemId: item.id as number | null,
				itemCode: item.itemCode,
				itemName: item.itemName,
				checkType: item.checkType,
				unitId: item.unitId as number | null,
				targetValue: item.targetValue as number | null,
				minValue: item.minValue as number | null,
				maxValue: item.maxValue as number | null,
				expectedResult: item.expectedResult as string | null,
				isRequired: item.isRequired as boolean | null,
			})),
		};
	}
	private _emptyChecklistItemRow() {
		return {
			id: this._tempItemId--,
			maintenanceOrderChecklistId: null as number | null,
			maintenanceChecklistItemId: null as number | null,
			sequenceNo: 0,
			itemCode: "",
			itemName: "",
			checkType: 1,
			unitId: null as number | null,
			targetValue: null as number | null,
			minValue: null as number | null,
			maxValue: null as number | null,
			expectedResult: null as string | null,

			actualValue: null as number | null,
			actualText: null as string | null,
			result: null as number | null,
			isRequired: true as boolean | null,
			completedDate: null as string | null,
			completedBy: null as number | null,
			remark: null as string | null,
			failureCodeId: null as number | null,
		};
	}

	private _validate(): string {
		const orderNo = this.form.orderNo.trim();

		if (!orderNo) {
			return this.i18n.t('maintenanceOrder.err.orderNoRequired');
		}

		if (!this.form.maintenanceTypeId || this.form.maintenanceTypeId <= 0) {
			return this.i18n.t('maintenanceOrder.err.maintenanceTypeRequired');
		}

		if (!this.form.machineId || this.form.machineId <= 0) {
			return this.i18n.t('maintenanceOrder.err.machineRequired');
		}

		const clash = this.maintenanceOrders().find(
			order =>
				order.orderNo.toLowerCase() === orderNo.toLowerCase() &&
				order.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('maintenanceOrder.err.orderNoTaken', { orderNo })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<MaintenanceOrderDto> {
		const body: MaintenanceOrderRequest = {
			orderNo: this.form.orderNo,
			maintenancePlanId: this.form.maintenancePlanId ?? null,
			maintenanceTypeId: this.form.maintenanceTypeId,
			machineId: this.form.machineId,
			priority: this.form.priority,
			status: this.form.status,
			plannedStartDate: this.form.plannedStartDate ?? null,
			plannedEndDate: this.form.plannedEndDate ?? null,
			actualStartDate: this.form.actualStartDate ?? null,
			actualEndDate: this.form.actualEndDate ?? null,
			responsibleEmployeeId: this.form.responsibleEmployeeId ?? null,
			description: this.form.description ?? null,
			completionNote: this.form.completionNote ?? null,
			remark: this.form.remark ?? null,
			maintenanceOrderChecklists: this.checklistRows().map((r, key) => ({
				id: r.id > 0 ? r.id : 0,
				maintenanceOrderId: r.maintenanceOrderId ?? null,
				maintenanceChecklistId: r.maintenanceChecklistId ?? null,
				checklistCode: r.checklistCode,
				checklistName: r.checklistName,
				checklistVersion: r.checklistVersion ?? null,
				status: r.status,
				startedDate: r.startedDate ?? null,
				completedDate: r.completedDate ?? null,
				completedBy: r.completedBy ?? null,
				remark: r.remark ?? null,
				maintenanceOrderChecklistItems: r.maintenanceOrderChecklistItems.map((item, key) => ({
					id: item.id > 0 ? item.id : 0,
					maintenanceOrderChecklistId: item.maintenanceOrderChecklistId ?? null,
					maintenanceChecklistItemId: item.maintenanceChecklistItemId ?? null,
					sequenceNo: key + 1,
					itemCode: item.itemCode,
					itemName: item.itemName,
					checkType: item.checkType,
					unitId: item.unitId ?? null,
					targetValue: item.targetValue ?? null,
					minValue: item.minValue ?? null,
					maxValue: item.maxValue ?? null,
					expectedResult: item.expectedResult ?? null,
					actualValue: item.actualValue ?? null,
					actualText: item.actualText ?? null,
					result: item.result ?? null,
					isRequired: item.isRequired ?? true,
					completedDate: item.completedDate ?? null,
					completedBy: item.completedBy ?? null,
					remark: item.remark ?? null,
					failureCodeId: item.failureCodeId ?? null,
				}))
			}))
		};

		console.log('body:', body);
		return id ? this.maintenanceOrderApi.update(id, body) : this.maintenanceOrderApi.create(body);
	}

	private _nextOrderNo(): string {
		let code = "";

		const prefixCode = "MO_";
		const maxCode = Math.max(
			0,
			...this.maintenanceOrderApi.items()
				.filter(x => x.orderNo.startsWith(prefixCode))
				.map(x => parseInt(x.orderNo.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}

	// private _nextItemCode(): string {
	// 	let code = "";

	// 	const prefixCode = "ITM_";
	// 	const maxCode = Math.max(
	// 		0,
	// 		...this.itemRows()
	// 			.filter(x => x.itemCode.startsWith(prefixCode))
	// 			.map(x => parseInt(x.itemCode.replace(prefixCode, '')))
	// 	);

	// 	code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
	// 	return code;
	// }

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
