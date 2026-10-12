import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmationService, MessageService, TreeNode } from 'primeng/api';
import { ProductGroupApiService } from '../../core/services/product-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PERMISSIONS } from '../../core/auth/permissions';
import { ProductGroupDto, ProductGroupRequest } from '../../domain/models/product.model';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { SelectModule } from 'primeng/select';
import { TreeTableModule } from 'primeng/treetable';

type EntityKind = 'productGroup';

@Component({
	selector: 'app-product-group',
	standalone: true,
	imports: [
		CommonModule, FormsModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
		InputTextModule, TableModule, TreeTableModule,
		HasPermissionDirective, SelectModule
	],
	providers: [MessageService, ConfirmationService],
	templateUrl: './product-group.component.html',
	styleUrl: './product-group.component.scss',
})
export class ProductGroupComponent extends PermissionAwarePage implements OnInit {

	private readonly groupApi = inject(ProductGroupApiService);
	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);

	readonly loading = computed(() => this.groupApi.loading());


	// ─── Lookups ────────────────────────────────────────────────────────────────
	readonly parentOptions = computed(() =>
		this.groupApi.items()
			.filter(u => u.id != this.editingId() && u.parentId == 0)
			.map(u => ({ label: `${u.groupNo} · ${u.groupName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────

	readonly selectedGroup = signal<ProductGroupDto | null>(null);

	/** Type filter above the product list — the first thing an operator reaches for. */
	readonly typeFilter = signal<string | null>(null);

	readonly groups = computed(() => {
		const typeId = this.typeFilter();
		const all = this.groupApi.items();
		return typeId === null ? all : all.filter(p => p.groupNo === typeId);
	});

	readonly treeData = computed(() => {
		const typeId = this.typeFilter();
		const all = this.groupApi.items();
		return typeId === null ? this.buildTree(all) : this.buildTree(all.filter(p => p.groupNo === typeId));
	});

	/** Receipts the backend holds with no id. No panel here can reach them. */
	readonly unassignedGroups = computed(() => this.groupApi.items().filter(b => b.id == null).length);
	// treeData = signal<TreeNode[]>([]);

	constructor() {
		// The toolbar still gates through `*appHasPermission`: its `<ng-template>` already
		// binds a `canAdd` context variable meaning "a row can be added right now", which
		// would shadow the inherited signal of the same name.
		super(PERMISSIONS.productGroup);

		effect(() => {
			const groups = this.groups();
			untracked(() => this.selectedGroup.set(this._reconcile(this.selectedGroup(), groups)));
		});
	}

	ngOnInit(): void {
		this.reload();
		// this.treeData.set(this.buildTree(this.groups()));

		console.log(this.treeData());
	}

	reload(): void {
		forkJoin({
			groups: this.groupApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('productGroup.err.load'), err),
		});
	}

	private buildTree(items: any[]): TreeNode[] {
		const map = new Map<number, TreeNode>();
		const roots: TreeNode[] = [];

		// Tạo TreeNode cho tất cả item
		for (const item of items) {
			map.set(item.id, {
				key: item.id.toString(),
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

	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly groupTable = viewChild<Table>('groupTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		productGroup: ['groupNo'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = { productGroup: this.groupTable() }[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'productGroup') {
			this.selectedGroup.set(this._reconcile(this.selectedGroup(), visible as ProductGroupDto[]));
		}
	}

	selectGroup(group: ProductGroupDto): void {
		if (this.selectedGroup()?.id === group.id) return;
		this.selectedGroup.set(group);
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('productGroup.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };
		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedGroup();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			id: row.id,
			groupNo: row.groupNo ?? '',
			groupName: row.groupName ?? '',
			parentId: row.parentId ?? 0
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
		this._saveGroup(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('productGroup.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('productGroup.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedGroup();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('productGroup.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.groupNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.groupApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.groupNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('productGroup.lower') }), err),
			}),
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			id: 0,
			groupNo: '',
			groupName: '',
			parentId: 0,
		};
	}


	private _validate(): string {
		const groupNo = this.form.groupNo.trim();

		if (!groupNo) {
			return this.i18n.t('productGroup.err.groupNoRequired');
		}

		if (!this.form.groupName) {
			return this.i18n.t('productGroup.err.groupNameRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.groups().find(
			group =>
				group.groupNo.toLowerCase() === groupNo.toLowerCase() &&
				group.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('productGroup.err.groupNoTaken', { groupNo })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveGroup(id: number | null): Observable<ProductGroupDto> {
		const body: ProductGroupRequest = {
			groupNo: this.form.groupNo.trim(),
			groupName: this.form.groupName.trim(),
			parentId: this.form.parentId,
		};
		return id ? this.groupApi.update(id, body) : this.groupApi.create(body);
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
