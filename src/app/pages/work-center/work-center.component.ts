import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { ConfirmationService, MessageService } from 'primeng/api';
import { FactoryApiService } from '../../core/services/master-data-api.service';
import { UserApiService, WorkCenterApiService, WorkshopApiService } from '../../core/services/organization-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { WORK_CENTER_STATUSES, WORK_CENTER_TYPES, WorkCenterDto, WorkCenterRequest, workCenterStatusOf } from '../../domain/models/organization.model';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'workcenter';

@Component({
	selector: 'app-work-center',
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
		TagModule
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './work-center.component.html',
	styleUrl: './work-center.component.scss',
})
export class WorkCenterComponent extends PermissionAwarePage implements OnInit {
	private readonly factoryApi = inject(FactoryApiService);
	private readonly workshopApi = inject(WorkshopApiService);
	private readonly userApi = inject(UserApiService);

	private readonly workCenterApi = inject(WorkCenterApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	readonly statusOf = workCenterStatusOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────
	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
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

	typeLabel(type?: number | null): string {
		if (type == null) return '';
		const item = WORK_CENTER_TYPES.find(u => u.value === type);
		return item ? this.i18n.t(item.labelKey) : '';
	}

	statusLabel(status?: number | null): string {
		if (status == null) return '';
		const item = WORK_CENTER_STATUSES.find(u => u.value === status);
		return item ? this.i18n.t(item.labelKey) : '';
	}

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly factoryOptions = computed(() =>
		this.factoryApi.items().map(u => ({ label: `${u.factoryCode} · ${u.factoryName}`, value: u.id })));

	readonly workshopOptions = computed(() =>
		this.workshopApi.items().map(u => ({ label: `${u.workshopCode} · ${u.workshopName}`, value: u.id })));

	readonly typeOptions = computed(() =>
		WORK_CENTER_TYPES.map(d => ({ label: this.i18n.t(d.labelKey), value: d.value })));

	readonly statusOptions = computed(() =>
		WORK_CENTER_STATUSES.map(d => ({ label: this.i18n.t(d.labelKey), value: d.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedWorkCenter = signal<WorkCenterDto | null>(null);
	readonly workcenters = computed(() => {
		const all = this.workCenterApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly workcenterTable = viewChild<Table>('workcenterTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		workcenter: ['workCenterCode', 'workCenterName', 'shortName', 'englishName', 'location', 'description'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			workcenter: this.workcenterTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'workcenter') {
			this.selectedWorkCenter.set(this._reconcile(this.selectedWorkCenter(), visible as WorkCenterDto[]));
		}
	}

	selectWorkCenter(workcenter: WorkCenterDto): void {
		if (this.selectedWorkCenter()?.id === workcenter.id) return;
		this.selectedWorkCenter.set(workcenter);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.workcenter);

		effect(() => {
			const workcenters = this.workcenters();
			untracked(() => this.selectedWorkCenter.set(this._reconcile(this.selectedWorkCenter(), workcenters)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			workcenters: this.workCenterApi.load(),
			users: this.userApi.load(),
			workshops: this.workshopApi.load(),
			factories: this.factoryApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('workcenter.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('workcenter.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm(), workCenterCode: this._nextWorkCenterCode() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedWorkCenter();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			factoryId: row.factoryId ?? null,
			workshopId: row.workshopId ?? null,
			workCenterCode: row.workCenterCode.trim(),
			workCenterName: row.workCenterName.trim(),
			shortName: row.shortName?.trim() ?? null,
			englishName: row.englishName?.trim() ?? null,
			workCenterType: row.workCenterType ?? 1,
			managerId: row.managerId,
			location: row.location?.trim() ?? null,
			description: row.description?.trim() ?? null,
			status: row.status,
			sortOrder: row.sortOrder ?? null,
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
		this._saveWorkCenter(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('workcenter.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('workcenter.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedWorkCenter();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('workcenter.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.workCenterCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.workCenterApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.workCenterCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('workcenter.lower') }), err),
			}),
		});
	}


	onFactoryChange(factoryId: number | null): void {
		if (this.form.sortOrder !== 0) return;
		this.form.sortOrder = this._nextSortOrder(factoryId ?? 0);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			factoryId: null as number | null,
			workshopId: null as number | null,
			workCenterCode: '',
			workCenterName: '',
			shortName: null as string | null,
			englishName: null as string | null,
			workCenterType: 1,
			managerId: 0,
			location: null as string | null,
			description: null as string | null,
			status: 1,
			sortOrder: 0,
		};
	}


	private _validate(): string {
		const workCenterCode = this.form.workCenterCode.trim();

		if (!workCenterCode) {
			return this.i18n.t('workcenter.err.workCenterCodeRequired');
		}

		if (!this.form.workCenterName) {
			return this.i18n.t('workcenter.err.workCenterNameRequired');
		}
		if (!this.form.managerId || this.form.managerId <= 0) {
			return this.i18n.t('workcenter.err.managerRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.workcenters().find(
			workcenter =>
				workcenter.workCenterCode.toLowerCase() === workCenterCode.toLowerCase() &&
				workcenter.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('workcenter.err.workCenterCodeTaken', { workCenterCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveWorkCenter(id: number | null): Observable<WorkCenterDto> {

		const body: WorkCenterRequest = {
			factoryId: this.form.factoryId ?? null,
			workshopId: this.form.workshopId ?? null,
			workCenterCode: this.form.workCenterCode,
			workCenterName: this.form.workCenterName,
			shortName: this.form.shortName ?? null,
			englishName: this.form.englishName ?? null,
			workCenterType: this.form.workCenterType ?? null,
			managerId: this.form.managerId,
			location: this.form.location ?? null,
			description: this.form.description ?? null,
			status: this.form.status,
			sortOrder: this.form.sortOrder,
		};
		return id ? this.workCenterApi.update(id, body) : this.workCenterApi.create(body);
	}

	private _nextSortOrder(factoryId: number): number {

		console.log('factoryId', factoryId);
		const maxSortOrder = Math.max(
			0,
			...this.workCenterApi
				.items()
				.filter(x => x.factoryId === factoryId)
				.map(x => x.sortOrder)
		);
		console.log('maxSortOrder', maxSortOrder);
		return maxSortOrder + 1;
	}

	private _nextWorkCenterCode(): string {
		let code = "";

		const prefixCode = "WCT_";
		const maxCode = Math.max(
			0,
			...this.workCenterApi.items()
				.filter(x => x.workCenterCode.startsWith(prefixCode))
				.map(x => parseInt(x.workCenterCode.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
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
