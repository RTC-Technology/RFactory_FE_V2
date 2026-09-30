import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
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
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { FactoryApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { CompanyApiService, WorkshopApiService, UserApiService, WorkCenterApiService, ProductionTeamApiService, ProductionTeamEmployeeApiService, DepartmentApiService } from '../../core/services/organization-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { ProductionTeamDto, ProductionTeamEmployeeDto, ProductionTeamRequest, WorkCenterDto, workCenterStatusOf } from '../../domain/models/organization.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Tab, Tabs, TabsModule } from 'primeng/tabs';
import { CheckboxModule } from 'primeng/checkbox';
import { ToggleButtonModule } from 'primeng/togglebutton';

type EntityKind = 'productionTeam' | 'productionTeamEmployee';
const DATETIME_LOCAL = "yyyy-MM-dd";

@Component({
	selector: 'app-production-team',
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
	templateUrl: './production-team.component.html',
	styleUrl: './production-team.component.scss',
})
export class ProductionTeamComponent extends PermissionAwarePage implements OnInit {
	private readonly companyApi = inject(CompanyApiService);
	private readonly factoryApi = inject(FactoryApiService);
	private readonly workshopApi = inject(WorkshopApiService);
	private readonly departmentApi = inject(DepartmentApiService);
	private readonly userApi = inject(UserApiService);

	private readonly teamApi = inject(ProductionTeamApiService);
	private readonly teamEmployeeApi = inject(ProductionTeamEmployeeApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────


	companyLabel(id?: number | null): string {
		if (id == null) return '';
		const company = this.companyApi.items().find(u => u.id === id);
		return company ? `${company.companyCode} · ${company.companyName}` : '';
	}

	factoryLabel(id?: number | null): string {
		if (id == null) return '';
		const factory = this.factoryApi.items().find(u => u.id === id);
		return factory ? `${factory.factoryCode} · ${factory.factoryName}` : '';
	}

	workshopLabel(id?: number | null): string {
		if (id == null) return '';
		const workshop = this.workshopApi.items().find(u => u.id === id);
		return workshop ? `${workshop.workshopCode} · ${workshop.workshopName}` : '';
	}

	departmentLabel(id?: number | null): string {
		if (id == null) return '';
		const department = this.departmentApi.items().find(u => u.id === id);
		return department ? `${department.departmentCode} · ${department.departmentName}` : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}


	readonly companyOptions = computed(() =>
		this.companyApi.items().map(u => ({ label: `${u.companyCode} · ${u.companyName}`, value: u.id })));

	readonly factoryOptions = computed(() =>
		this.factoryApi.items().map(u => ({ label: `${u.factoryCode} · ${u.factoryName}`, value: u.id })));

	readonly workshopOptions = computed(() =>
		this.workshopApi.items().map(u => ({ label: `${u.workshopCode} · ${u.workshopName}`, value: u.id })));

	readonly departmentOptions = computed(() =>
		this.departmentApi.items().map(u => ({ label: `${u.departmentCode} · ${u.departmentName}`, value: u.id })));

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly teamOptions = computed(() =>
		this.teamApi.items().map(u => ({ label: `${u.teamCode} · ${u.teamName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedTeam = signal<ProductionTeamDto | null>(null);
	readonly selectedEmployee = signal<ProductionTeamEmployeeDto | null>(null);

	readonly teams = computed(() => {
		const all = this.teamApi.items();
		return all;
	});

	readonly employees = computed(() => {
		const id = this.selectedTeam()?.id;
		if (id == null) return [];
		return this.teamEmployeeApi.items().filter(e => e.productionTeamId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly teamTable = viewChild<Table>('teamTable');
	private readonly employeeTable = viewChild<Table>('employeeTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		productionTeam: ['teamCode', 'teamName', 'description'],
		productionTeamEmployee: ['employeeCode', 'employeeName', 'position'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			productionTeam: this.teamTable(),
			productionTeamEmployee: this.employeeTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'productionTeam') {
			this.selectedTeam.set(this._reconcile(this.selectedTeam(), visible as ProductionTeamDto[]));
		} else if (kind === 'productionTeamEmployee') {
			this.selectedEmployee.set(this._reconcile(this.selectedEmployee(), visible as ProductionTeamEmployeeDto[]));
		}
	}

	selectTeam(team: ProductionTeamDto): void {
		if (this.selectedTeam()?.id === team.id) return;
		this.selectedTeam.set(team);
	}

	selectEmployee(employee: ProductionTeamEmployeeDto): void {
		if (this.selectedEmployee()?.id === employee.id) return;
		this.selectedEmployee.set(employee);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.productionTeam);

		effect(() => {
			const teams = this.teams();
			untracked(() => this.selectedTeam.set(this._reconcile(this.selectedTeam(), teams)));
		});

		effect(() => {
			const employees = this.employees();
			untracked(() => this.selectedEmployee.set(this._reconcile(this.selectedEmployee(), employees)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			productionTeams: this.teamApi.load(),
			productionTeamEmployees: this.teamEmployeeApi.load(),

			companies: this.companyApi.load(),
			workshops: this.workshopApi.load(),
			factories: this.factoryApi.load(),
			department: this.departmentApi.load(),
			users: this.userApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('productionTeam.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();
	readonly employeeRows = signal<ProductionTeamEmployeeDto[]>([]);
	private _tempEmployeeId = 0;
	activeTab = 'team';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('productionTeam.lower'),
		}));


	openCreate(kind: EntityKind): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), teamCode: this._nextCode() };
		this.employeeRows.set([this._emptyEmployeeRow()]);

		if (kind === 'productionTeamEmployee') {
			this.openEdit(kind);
			return;
		}

		this.dialogOpen.set(true);
	}

	openEdit(kind: EntityKind): void {
		const row = this.selectedTeam();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		// console.log('row', row);

		this.form = {
			companyId: row.companyId ?? null,
			factoryId: row.factoryId ?? null,
			workshopId: row.workshopId ?? null,
			departmentId: row.departmentId,
			teamCode: row.teamCode,
			teamName: row.teamName,
			shortName: row.shortName ?? null,
			englishName: row.englishName ?? null,
			teamLeaderId: row.teamLeaderId,
			deputyLeaderId: row.deputyLeaderId ?? null,
			phone: row.phone ?? null,
			email: row.email ?? null,
			location: row.location ?? null,
			description: row.description ?? null,
			isActive: row.isActive,
			sortOrder: row.sortOrder,
		};

		this.employeeRows.set(
			this.teamEmployeeApi.items()
				.filter(d => d.productionTeamId === row.id)
				.map(d => ({
					...d,
					fromDate: this._toLocalInput(d.fromDate),
					toDate: this._toLocalInput(d.toDate),
				})));

		if (kind === 'productionTeamEmployee') this.activeTab = 'employee';
		else this.activeTab = 'team';

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
		this._saveTeam(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('productionTeam.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('productionTeam.lower') }));
			},
		});
	}

	askDelete(kind: EntityKind): void {
		const row = kind === 'productionTeam'
			? this.selectedTeam()
			: this.selectedEmployee();

		if (!row) return;

		const label = kind === 'productionTeam'
			? (row as ProductionTeamDto).teamCode
			: this.userLabel((row as ProductionTeamEmployeeDto).employeeId);

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t(kind === 'productionTeam' ? 'productionTeam.lower' : 'productionTeamEmployee.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => (kind === 'productionTeam' ? this.teamApi.remove(row.id) : this.teamEmployeeApi.remove(row.id)).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t(kind === 'productionTeam' ? 'productionTeam.lower' : 'productionTeamEmployee.lower') }), err),
			}),
		});
	}

	onDepartmentChange(departmentId: number | null): void {
		if (this.form.sortOrder !== 0) return;
		this.form.sortOrder = this._nextSortOrder(departmentId ?? 0);
	}

	// ─── Employee grid ────────────────────────────────────────────────────────────
	addEmployeeRow(): void {
		this.employeeRows.update(rows => [...rows, this._emptyEmployeeRow()]);
		console.log('employeeRows:', this.employeeRows());
	}

	removeEmployeeRow(row: ProductionTeamEmployeeDto): void {
		this.employeeRows.update(rows => rows.filter(r => r !== row));
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			companyId: null as number | null,
			factoryId: null as number | null,
			workshopId: null as number | null,
			departmentId: 0,
			teamCode: '',
			teamName: '',
			shortName: null as string | null,
			englishName: null as string | null,
			teamLeaderId: 0,
			deputyLeaderId: null as number | null,
			phone: null as string | null,
			email: null as string | null,
			location: null as string | null,
			description: null as string | null,
			isActive: true,
			sortOrder: 0,
		};
	}

	private _emptyEmployeeRow() {
		return {
			id: this._tempEmployeeId--,
			productionTeamId: null as number | null,
			employeeId: null as number | null,
			isPrimary: true,
			fromDate: formatDate(new Date(), DATETIME_LOCAL, 'en-US'),
			toDate: null as string | null,
			remark: null as string | null,
		};
	}


	private _validate(): string {
		const teamCode = this.form.teamCode.trim();

		if (!teamCode) {
			return this.i18n.t('productionTeam.err.teamCodeRequired');
		}

		if (!this.form.teamName) {
			return this.i18n.t('productionTeam.err.teamNameRequired');
		}
		if (!this.form.teamLeaderId || this.form.teamLeaderId <= 0) {
			return this.i18n.t('productionTeam.err.teamLeaderRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.teams().find(
			team =>
				team.teamCode.toLowerCase() === teamCode.toLowerCase() &&
				team.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('productionTeam.err.teamCodeTaken', { teamCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveTeam(id: number | null): Observable<ProductionTeamDto> {
		const body: ProductionTeamRequest = {
			companyId: this.form.companyId ?? null,
			factoryId: this.form.factoryId ?? null,
			workshopId: this.form.workshopId ?? null,
			departmentId: this.form.departmentId,
			teamCode: this.form.teamCode,
			teamName: this.form.teamName,
			shortName: this.form.shortName ?? null,
			englishName: this.form.englishName ?? null,
			teamLeaderId: this.form.teamLeaderId,
			deputyLeaderId: this.form.deputyLeaderId ?? null,
			phone: this.form.phone ?? null,
			email: this.form.email ?? null,
			location: this.form.location ?? null,
			description: this.form.description ?? null,
			isActive: this.form.isActive,
			sortOrder: this.form.sortOrder,
			employees: this.employeeRows().map(r => ({
				id: r.id > 0 ? r.id : 0,
				productionTeamId: r.productionTeamId,
				employeeId: r.employeeId ?? 0,
				isPrimary: r.isPrimary ?? true,
				fromDate: r.fromDate,
				toDate: r.toDate ?? null,
				remark: r.remark ?? null,
			})).filter(r => r.employeeId > 0), // ignore lines with no employee
		};
		return id ? this.teamApi.update(id, body) : this.teamApi.create(body);
	}

	private _nextSortOrder(departmentId: number): number {
		const maxSortOrder = Math.max(
			0,
			...this.teamApi
				.items()
				.filter(x => x.departmentId === departmentId)
				.map(x => x.sortOrder)
		);
		return maxSortOrder + 1;
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "PT_";
		const maxCode = Math.max(
			0,
			...this.teamApi.items()
				.filter(x => x.teamCode.startsWith(prefixCode))
				.map(x => parseInt(x.teamCode.replace(prefixCode, '')))
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
