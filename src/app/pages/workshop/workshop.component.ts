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
import { CompanyApiService, UserApiService, WorkshopApiService } from '../../core/services/organization-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { FactoryApiService } from '../../core/services/master-data-api.service';
import { WorkshopDto, WorkshopRequest } from '../../domain/models/organization.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'workshop';

@Component({
	selector: 'app-workshop',
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
		Textarea
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './workshop.component.html',
	styleUrl: './workshop.component.scss',
})
export class WorkshopComponent extends PermissionAwarePage implements OnInit {
	private readonly workshopApi = inject(WorkshopApiService);

	private readonly companyApi = inject(CompanyApiService);
	private readonly factoryApi = inject(FactoryApiService);
	private readonly userApi = inject(UserApiService);

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

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	readonly companyOptions = computed(() =>
		this.companyApi.items().map(u => ({ label: `${u.companyCode} · ${u.companyName}`, value: u.id })));

	readonly factoryOptions = computed(() =>
		this.factoryApi.items().map(u => ({ label: `${u.factoryCode} · ${u.factoryName}`, value: u.id })));

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedWorkshop = signal<WorkshopDto | null>(null);

	readonly workshops = computed(() => {
		const all = this.workshopApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly workshopTable = viewChild<Table>('workshopTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		workshop: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			workshop: this.workshopTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'workshop') {
			this.selectedWorkshop.set(this._reconcile(this.selectedWorkshop(), visible as WorkshopDto[]));
		}
	}

	selectWorkshop(workshop: WorkshopDto): void {
		if (this.selectedWorkshop()?.id === workshop.id) return;
		this.selectedWorkshop.set(workshop);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.workshop);

		effect(() => {
			const workshops = this.workshops();
			untracked(() => this.selectedWorkshop.set(this._reconcile(this.selectedWorkshop(), workshops)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			workshops: this.workshopApi.load(),
			companies: this.companyApi.load(),
			factories: this.factoryApi.load(),
			users: this.userApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('workshop.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	uploadedFiles: any[] = [];

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('workshop.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedWorkshop();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			companyId: row.companyId ?? null,
			factoryId: row.factoryId ?? null,
			workshopCode: row.workshopCode.trim(),
			workshopName: row.workshopName.trim(),
			shortName: row.shortName.trim(),
			englishName: row.englishName.trim(),
			managerId: row.managerId ?? null,
			phone: row.phone.trim(),
			email: row.email.trim(),
			location: row.location.trim(),
			description: row.description.trim(),
			isActive: row.isActive,
			sortOrder: row.sortOrder,
		};

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
		this._saveCompany(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('workshop.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('workshop.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedWorkshop();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('workshop.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.workshopCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.workshopApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.workshopCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('workshop.lower') }), err),
			}),
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			companyId: null as number | null,
			factoryId: null as number | null,
			workshopCode: '',
			workshopName: '',
			shortName: '',
			englishName: '',
			managerId: null as number | null,
			phone: '',
			email: '',
			location: '',
			description: '',

			isActive: true,
			sortOrder: 1,
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

	private _saveCompany(id: number | null): Observable<WorkshopDto> {
		const body: WorkshopRequest = {
			companyId: this.form.companyId ?? null,
			factoryId: this.form.factoryId ?? null,
			workshopCode: this.form.workshopCode.trim(),
			workshopName: this.form.workshopName.trim(),
			shortName: this.form.shortName.trim(),
			englishName: this.form.englishName.trim(),
			managerId: this.form.managerId ?? null,
			phone: this.form.phone.trim(),
			email: this.form.email.trim(),
			location: this.form.location.trim(),
			description: this.form.description.trim(),
			isActive: this.form.isActive,
			sortOrder: this.form.sortOrder,
		};
		return id ? this.workshopApi.update(id, body) : this.workshopApi.create(body);
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
