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
import { ConfirmationService, MessageService, TreeNode } from 'primeng/api';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { CompanyApiService, DepartmentApiService, UserApiService, WorkshopApiService } from '../../core/services/organization-api.service';
import { FactoryApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { DepartmentDto, DepartmentRequest } from '../../domain/models/organization.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TreeTableModule } from 'primeng/treetable';
import { TreeSelectModule } from 'primeng/treeselect';

type EntityKind = 'department';

@Component({
	selector: 'app-department',
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
		TreeTableModule,
		TreeSelectModule
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './department.component.html',
	styleUrl: './department.component.scss',
})
export class DepartmentComponent extends PermissionAwarePage implements OnInit {
	private readonly companyApi = inject(CompanyApiService);
	private readonly factoryApi = inject(FactoryApiService);
	private readonly workshopApi = inject(WorkshopApiService);
	private readonly userApi = inject(UserApiService);

	private readonly departmentApi = inject(DepartmentApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

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

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly companyOptions = computed(() =>
		this.companyApi.items().map(u => ({ label: `${u.companyCode} · ${u.companyName}`, value: u.id })));

	readonly factoryOptions = computed(() =>
		this.factoryApi.items().map(u => ({ label: `${u.factoryCode} · ${u.factoryName}`, value: u.id })));

	readonly workshopOptions = computed(() =>
		this.workshopApi.items().map(u => ({ label: `${u.workshopCode} · ${u.workshopName}`, value: u.id })));

	readonly departmentOptions = computed(() =>
		this.departmentApi.items().map(u => ({ label: `${u.departmentCode} · ${u.departmentName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedDepartment = signal<DepartmentDto | null>(null);

	readonly departments = computed(() => {
		const all = this.departmentApi.items();
		return all;

	});


	readonly departmentTree = computed(() => {
		const all = this.departmentApi.items();

		console.log('tree: ', this.buildTree(all));
		return this.buildTree(all);

	});


	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly departmentTable = viewChild<Table>('departmentTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		department: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			department: this.departmentTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'department') {
			this.selectedDepartment.set(this._reconcile(this.selectedDepartment(), visible as DepartmentDto[]));
		}
	}

	selectDepartment(department: DepartmentDto): void {
		if (this.selectedDepartment()?.id === department.id) return;
		this.selectedDepartment.set(department);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.department);

		effect(() => {
			const departments = this.departments();
			untracked(() => this.selectedDepartment.set(this._reconcile(this.selectedDepartment(), departments)));
		});


	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			departments: this.departmentApi.load(),
			users: this.userApi.load(),
			workshops: this.workshopApi.load(),
			factories: this.factoryApi.load(),
			companies: this.companyApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('department.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	selectedNodes: any;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('department.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedDepartment();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			companyId: row.companyId ?? null,
			factoryId: row.factoryId ?? null,
			workshopId: row.workshopId ?? null,
			parentId: row.parentId ?? 0,
			departmentCode: row.departmentCode.trim(),
			departmentName: row.departmentName.trim(),
			shortName: row.shortName?.trim() ?? null,
			englishName: row.englishName?.trim() ?? null,
			managerId: row.managerId ?? null,
			phone: row.phone?.trim() ?? null,
			email: row.email?.trim() ?? null,
			location: row.location?.trim() ?? null,
			description: row.description?.trim() ?? null,
			isActive: row.isActive,
			sortOrder: row.sortOrder,
		};

		this.selectedNodes = this.findTreeNodeByKey(this.departmentTree(), row.parentId ?? 0);
		console.log('this.selectedNodes: ', this.selectedNodes);

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
		this._saveDepartment(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('department.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('department.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedDepartment();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('department.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.departmentName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.departmentApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.departmentName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('department.lower') }), err),
			}),
		});
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			companyId: null as number | null,
			factoryId: null as number | null,
			workshopId: null as number | null,
			parentId: 0,
			departmentCode: '',
			departmentName: '',
			shortName: null as string | null,
			englishName: null as string | null,
			managerId: null as number | null,
			phone: null as string | null,
			email: null as string | null,
			location: null as string | null,
			description: null as string | null,
			isActive: true,
			sortOrder: 0,
		};
	}


	private _validate(): string {
		const departmentCode = this.form.departmentCode.trim();

		if (!departmentCode) {
			return this.i18n.t('department.err.departmentCodeRequired');
		}

		if (!this.form.departmentName) {
			return this.i18n.t('department.err.departmentNameRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.departments().find(
			department =>
				department.departmentCode.toLowerCase() === departmentCode.toLowerCase() &&
				department.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('department.err.departmentCodeTaken', { departmentCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveDepartment(id: number | null): Observable<DepartmentDto> {

		const body: DepartmentRequest = {
			companyId: this.form.companyId ?? null,
			factoryId: this.form.factoryId ?? null,
			workshopId: this.form.workshopId ?? null,
			parentId: this.selectedNodes.data.id ?? 0,
			departmentCode: this.form.departmentCode,
			departmentName: this.form.departmentName,
			shortName: this.form.shortName ?? null,
			englishName: this.form.englishName ?? null,
			managerId: this.form.managerId ?? null,
			phone: this.form.phone ?? null,
			email: this.form.email ?? null,
			location: this.form.location ?? null,
			description: this.form.description ?? null,
			isActive: this.form.isActive,
			sortOrder: this.form.sortOrder,
		};
		return id ? this.departmentApi.update(id, body) : this.departmentApi.create(body);
	}

	private buildTree(items: any[]): TreeNode[] {
		const map = new Map<number, TreeNode>();
		const roots: TreeNode[] = [];

		// Tạo TreeNode cho tất cả item
		for (const item of items) {
			map.set(item.id, {
				key: item.id.toString(),
				label: `${item.departmentCode} · ${item.departmentName}`,
				data: item,
				children: []
			});
		}

		// Build quan hệ cha - con
		for (const item of items) {
			const node = map.get(item.id)!;

			if (item.parentId && item.parentId !== 0) {
				const parent = map.get(item.parentId);

				if (parent) {
					parent.children!.push(node);
				}
			} else {
				roots.push(node);
			}
		}

		return roots;
	}

	private findTreeNodeByKey(nodes: TreeNode[], key: string | number): TreeNode | null {
		for (const node of nodes) {
			if (node.key === key.toString()) return node;


			if (node.children?.length) {
				const found = this.findTreeNodeByKey(node.children, key);

				if (found) return found;

			}
		}

		return null;
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
