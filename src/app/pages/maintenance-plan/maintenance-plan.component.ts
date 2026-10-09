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
import { MaintenanceChecklistApiService, MaintenancePlanApiService, MaintenanceTypeApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { MAINTENANCE_PLAN_FREQUENCY_UNIT, MAINTENANCE_PLAN_STATUS, MAINTENANCE_TYPE_PRIORITY, MaintenancePlanDto, MaintenancePlanRequest, planStatusOf, priorityOf } from '../../domain/models/master-data.model';
import { MachineApiService } from '../../core/services/equipment-api.service';
import { DepartmentApiService, UserApiService, WorkCenterApiService } from '../../core/services/organization-api.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MaintenanceOrderComponent } from '../maintenance-order/maintenance-order.component';

type EntityKind = 'maintenancePlan';
const DATETIME_LOCAL = "yyyy-MM-dd";

@Component({
	selector: 'app-maintenance-plan',
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
		MaintenanceOrderComponent
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './maintenance-plan.component.html',
	styleUrl: './maintenance-plan.component.scss',
})
export class MaintenancePlanComponent extends PermissionAwarePage implements OnInit {
	private readonly maintenancePlanApi = inject(MaintenancePlanApiService);

	private readonly maintenanceTypeApi = inject(MaintenanceTypeApiService);
	private readonly machineApi = inject(MachineApiService);
	private readonly workCenterApi = inject(WorkCenterApiService);
	private readonly checklistApi = inject(MaintenanceChecklistApiService);
	private readonly departmentApi = inject(DepartmentApiService);
	private readonly userApi = inject(UserApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	prioritySeverity = priorityOf;
	statusSeverity = planStatusOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────

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

	workCenterLabel(id?: number | null): string {
		if (id == null) return '';
		const workCenter = this.workCenterApi.items().find(u => u.id === id);
		return workCenter ? `${workCenter.workCenterCode} · ${workCenter.workCenterName}` : '';
	}

	checklistLabel(id?: number | null): string {
		if (id == null) return '';
		const checklist = this.checklistApi.items().find(u => u.id === id);
		return checklist ? `${checklist.checklistCode} · ${checklist.checklistName}` : '';
	}

	departmentLabel(id?: number | null): string {
		if (id == null) return '';
		const dept = this.departmentApi.items().find(u => u.id === id);
		return dept ? `${dept.departmentCode} · ${dept.departmentName}` : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	frequencyUnitLabel(value?: number | null): string {
		if (value == null) return '';
		const type = MAINTENANCE_PLAN_FREQUENCY_UNIT.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	priorityLabel(value?: number | null): string {
		if (value == null) return '';
		const type = MAINTENANCE_TYPE_PRIORITY.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(value?: number | null): string {
		if (value == null) return '';
		const type = MAINTENANCE_PLAN_STATUS.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	readonly maintenanceTypeOptions = computed(() =>
		this.maintenanceTypeApi.items().map(u => ({ label: `${u.typeCode} · ${u.typeName}`, value: u.id })));

	readonly machineOptions = computed(() =>
		this.machineApi.items().map(u => ({ label: `${u.machineCode} · ${u.machineName}`, value: u.id })));

	readonly workCenterOptions = computed(() =>
		this.workCenterApi.items().map(u => ({ label: `${u.workCenterCode} · ${u.workCenterName}`, value: u.id })));

	readonly checklistOptions = computed(() =>
		this.checklistApi.items().map(u => ({ label: `${u.checklistCode} · ${u.checklistName}`, value: u.id })));

	readonly departmentOptions = computed(() =>
		this.departmentApi.items().map(u => ({ label: `${u.departmentCode} · ${u.departmentName}`, value: u.id })));

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly frequencyUnitOptions = computed(() =>
		MAINTENANCE_PLAN_FREQUENCY_UNIT.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		MAINTENANCE_PLAN_STATUS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly priorityOptions = computed(() =>
		MAINTENANCE_TYPE_PRIORITY.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedPlan = signal<MaintenancePlanDto | null>(null);

	readonly plans = computed(() => {
		const all = this.maintenancePlanApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly planTable = viewChild<Table>('table');

	readonly filterFields: Record<EntityKind, string[]> = {
		maintenancePlan: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			maintenancePlan: this.planTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'maintenancePlan') {
			this.selectedPlan.set(this._reconcile(this.selectedPlan(), visible as MaintenancePlanDto[]));
		}
	}

	selectPlan(plan: MaintenancePlanDto): void {
		if (this.selectedPlan()?.id === plan.id) return;
		this.selectedPlan.set(plan);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.maintenancePlan);

		effect(() => {
			const plans = this.plans();
			untracked(() => this.selectedPlan.set(this._reconcile(this.selectedPlan(), plans)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			maintenancePlans: this.maintenancePlanApi.load(),
			maintenanceTypes: this.maintenanceTypeApi.load(),
			machines: this.machineApi.load(),
			workCenters: this.workCenterApi.load(),
			checklists: this.checklistApi.load(),
			departments: this.departmentApi.load(),
			users: this.userApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('maintenancePlan.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly orderOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('maintenancePlan.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), planCode: this._nextCode() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPlan();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			planCode: row.planCode.trim(),
			planName: row.planName.trim(),
			maintenanceTypeId: row.maintenanceTypeId,
			machineId: row.machineId,
			workCenterId: row.workCenterId ?? null,
			maintenanceChecklistId: row.maintenanceChecklistId ?? null,
			frequency: row.frequency,
			frequencyUnit: row.frequencyUnit,
			startDate: this._toLocalInput(row.startDate) ?? formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			endDate: this._toLocalInput(row.endDate),
			lastMaintenanceDate: this._toLocalInput(row.lastMaintenanceDate),
			nextMaintenanceDate: this._toLocalInput(row.nextMaintenanceDate),
			priority: row.priority,
			status: row.status,
			responsibleDepartmentId: row.responsibleDepartmentId ?? null,
			responsibleEmployeeId: row.responsibleEmployeeId ?? null,
			remark: row.remark ?? null,
		};

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
					entity: this.i18n.t('maintenancePlan.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('maintenancePlan.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedPlan();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('maintenancePlan.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.planName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.maintenancePlanApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.planName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('maintenancePlan.lower') }), err),
			}),
		});
	}

	openOrder(): void {
		this.orderOpen.set(true);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			planCode: '',
			planName: '',
			maintenanceTypeId: 0,
			machineId: 0,
			workCenterId: null as number | null,
			maintenanceChecklistId: null as number | null,
			frequency: 0,
			frequencyUnit: 1,
			startDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			endDate: null as string | null,
			lastMaintenanceDate: null as string | null,
			nextMaintenanceDate: null as string | null,
			priority: 1,
			status: 1,
			responsibleDepartmentId: null as number | null,
			responsibleEmployeeId: null as number | null,
			remark: null as string | null,
		};
	}

	private _validate(): string {
		const planCode = this.form.planCode.trim();

		if (!planCode) {
			return this.i18n.t('maintenancePlan.err.planCodeRequired');
		}

		if (!this.form.planName) {
			return this.i18n.t('maintenancePlan.err.planNameRequired');
		}

		if (!this.form.maintenanceTypeId || this.form.maintenanceTypeId <= 0) {
			return this.i18n.t('maintenancePlan.err.maintenanceTypeRequired');
		}

		if (!this.form.machineId || this.form.machineId <= 0) {
			return this.i18n.t('maintenancePlan.err.machineRequired');
		}

		if (!this.form.frequency || this.form.frequency <= 0) {
			return this.i18n.t('maintenancePlan.err.frequencyRequired');
		}

		if (!this.form.frequencyUnit || this.form.frequencyUnit <= 0) {
			return this.i18n.t('maintenancePlan.err.frequencyUnitRequired');
		}

		if (!this.form.startDate) {
			return this.i18n.t('maintenancePlan.err.startDateRequired');
		}

		if (!this.form.status || this.form.status <= 0) {
			return this.i18n.t('maintenancePlan.err.statusRequired');
		}

		if (!this.form.priority || this.form.priority <= 0) {
			return this.i18n.t('maintenancePlan.err.priorityRequired');
		}

		const clash = this.plans().find(
			plan =>
				plan.planCode.toLowerCase() === planCode.toLowerCase() &&
				plan.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('maintenancePlan.err.planCodeTaken', { planCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<MaintenancePlanDto> {
		const body: MaintenancePlanRequest = {
			planCode: this.form.planCode,
			planName: this.form.planName,
			maintenanceTypeId: this.form.maintenanceTypeId,
			machineId: this.form.machineId,
			workCenterId: this.form.workCenterId ?? null,
			maintenanceChecklistId: this.form.maintenanceChecklistId ?? null,
			frequency: this.form.frequency,
			frequencyUnit: this.form.frequencyUnit,
			startDate: this.form.startDate,
			endDate: this.form.endDate ?? null,
			lastMaintenanceDate: this.form.lastMaintenanceDate ?? null,
			nextMaintenanceDate: this.form.nextMaintenanceDate ?? null,
			priority: this.form.priority,
			status: this.form.status,
			responsibleDepartmentId: this.form.responsibleDepartmentId ?? null,
			responsibleEmployeeId: this.form.responsibleEmployeeId ?? null,
			remark: this.form.remark ?? null,
		};
		return id ? this.maintenancePlanApi.update(id, body) : this.maintenancePlanApi.create(body);
	}


	private _nextCode(): string {
		let code = "";

		const prefixCode = "MP_";
		const maxCode = Math.max(
			0,
			...this.maintenancePlanApi.items()
				.filter(x => x.planCode.startsWith(prefixCode))
				.map(x => parseInt(x.planCode.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
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
