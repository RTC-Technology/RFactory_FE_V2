import { CommonModule } from '@angular/common';
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
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { FailureCodeApiService, FailureGroupApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { FAILURE_CODE_SEVERITY, FailureCodeDto, FailureCodeRequest, FailureGroupDto, FailureGroupRequest, failureSeverityOf } from '../../domain/models/master-data.model';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { PERMISSIONS } from '../../core/auth/permissions';

type EntityKind = 'failureCode' | 'failureGroup';

interface EntityForm {
	groupCode: string;
	groupName: string;
	shortName?: string | null;
	description?: string | null;
	sortOrder: number;
	isActive?: boolean | null;

	code: string;
	name: string;
	failureGroupId?: number | null;
	severity: number;
}

const LABEL_KEYS: Record<EntityKind, string> = {
	failureGroup: 'failureGroup.lower',
	failureCode: 'failureCode.lower',
};

@Component({
	selector: 'app-failure-code',
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
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './failure-code.component.html',
	styleUrl: './failure-code.component.scss',
})
export class FailureCodeComponent extends PermissionAwarePage implements OnInit {
	private readonly failureCodeApi = inject(FailureCodeApiService);
	private readonly failureGroupApi = inject(FailureGroupApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	readonly severityOf = failureSeverityOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────
	groupLabel(id?: number | null): string {
		if (id == null) return '';
		const group = this.failureGroupApi.items().find(u => u.id === id);
		return group ? `${group.groupCode} · ${group.groupName}` : '';
	}

	severityLabel(id?: number | null): string {
		if (id == null) return '';
		const severity = FAILURE_CODE_SEVERITY.find(u => u.value === id);
		return severity ? this.i18n.t(severity.labelKey) : '';
	}

	readonly groupOptions = computed(() =>
		this.failureGroupApi.items().map(u => ({ label: `${u.groupCode} · ${u.groupName}`, value: u.id })));

	readonly severityOptions = computed(() =>
		FAILURE_CODE_SEVERITY.map(u => ({ label: this.i18n.t(u.labelKey), value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCode = signal<FailureCodeDto | null>(null);
	readonly selectedGroup = signal<FailureGroupDto | null>(null);

	readonly groups = computed(() => {
		const all = this.failureGroupApi.items();
		return all;
	});

	readonly codes = computed(() => {
		const id = this.selectedGroup()?.id;
		if (id == null) return [];
		const all = this.failureCodeApi.items().filter(d => d.failureGroupId === id);
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly codeTable = viewChild<Table>('codeTable');
	private readonly groupTable = viewChild<Table>('groupTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		failureCode: ['code', 'name', 'shortName', 'description'],
		failureGroup: ['groupCode', 'groupName', 'shortName', 'description', 'sortOrder'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			failureCode: this.codeTable(),
			failureGroup: this.groupTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'failureCode') {
			this.selectedCode.set(this._reconcile(this.selectedCode(), visible as FailureCodeDto[]));
		} else if (kind === 'failureGroup') {
			this.selectedGroup.set(this._reconcile(this.selectedGroup(), visible as FailureGroupDto[]));
		}
	}

	selectCode(code: FailureCodeDto): void {
		if (this.selectedCode()?.id === code.id) return;
		this.selectedCode.set(code);
	}

	selectGroup(group: FailureGroupDto): void {
		if (this.selectedGroup()?.id === group.id) return;
		this.selectedGroup.set(group);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.failureCode);

		effect(() => {
			const codes = this.codes();
			untracked(() => this.selectedCode.set(this._reconcile(this.selectedCode(), codes)));
		});

		effect(() => {
			const groups = this.groups();
			untracked(() => this.selectedGroup.set(this._reconcile(this.selectedGroup(), groups)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			codes: this.failureCodeApi.load(),
			groups: this.failureGroupApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('failureCode.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly dialogKind = signal<EntityKind>('failureGroup');
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t(LABEL_KEYS[this.dialogKind()]),
		}));


	openCreate(kind: EntityKind): void {
		this.dialogKind.set(kind);
		this.editingId.set(null);
		this.formError.set('');
		this.form = {
			...this._emptyForm(),
			failureGroupId: this.selectedGroup()?.id ?? 0,
			sortOrder: this._nextSortOrder(),
			groupCode: this._nextGroupCode(),
			code: this._nextFailureCode()
		};

		this.dialogOpen.set(true);
	}

	openEdit(kind: EntityKind): void {
		const row = {
			failureGroup: this.selectedGroup(),
			failureCode: this.selectedCode(),
		}[kind];
		if (!row) return;

		this.dialogKind.set(kind);
		this.editingId.set(row.id);
		this.formError.set('');

		if (kind === 'failureCode') {
			const d = row as FailureCodeDto;
			this.form = {
				...this._emptyForm(),
				code: d.code,
				name: d.name,
				shortName: d.shortName ?? null,
				description: d.description ?? null,
				failureGroupId: d.failureGroupId ?? 0,
				severity: d.severity ?? 3,
				isActive: d.isActive ?? true,
			};
		} else {
			const d = row as FailureGroupDto;
			this.form = {
				...this._emptyForm(),
				groupCode: d.groupCode ?? '',
				groupName: d.groupName ?? '',
				shortName: d.shortName ?? null,
				description: d.description ?? null,
				sortOrder: d.sortOrder ?? this._nextSortOrder(),
				isActive: d.isActive ?? true,
			};
		}
		this.dialogOpen.set(true);
	}


	save(): void {
		const kind = this.dialogKind();
		const error = this._validate(kind);
		if (error) {
			this.formError.set(error);
			return;
		}

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		const request = this._buildRequest(kind, id);
		if (!request) {
			this.saving.set(false);
			return;
		}

		request.subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t(LABEL_KEYS[kind]),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t(LABEL_KEYS[kind]) }));
			},
		});
	}

	askDelete(kind: EntityKind): void {
		const row = kind === 'failureCode'
			? this.selectedCode()
			: this.selectedGroup();

		if (!row) return;

		const label = kind === 'failureCode'
			? (row as FailureCodeDto).code
			: (row as FailureGroupDto).groupCode;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t(kind === 'failureCode' ? 'failureCode.lower' : 'failureGroup.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => (kind === 'failureCode' ? this.failureCodeApi.remove(row.id) : this.failureGroupApi.remove(row.id)).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t(kind === 'failureCode' ? 'failureCode.lower' : 'failureGroup.lower') }), err),
			}),
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm(): EntityForm {
		return {
			groupCode: '',
			groupName: '',
			shortName: null as string | null,
			description: null as string | null,
			sortOrder: 0,
			isActive: true,

			code: '',
			name: '',
			failureGroupId: null as number | null,
			severity: 3,
		};
	}

	private _validate(kind: EntityKind): string {
		if (kind == 'failureCode') {
			const code = this.form.code?.trim();

			if (!code) {
				return this.i18n.t('failureCode.err.codeRequired');
			}

			if (!this.form.name) {
				return this.i18n.t('failureCode.err.nameRequired');
			}

			if (!this.form.severity || this.form.severity <= 0) {
				return this.i18n.t('failureCode.err.severityRequired');
			}

			const clash = this.codes().find(
				c =>
					c.code.toLowerCase() === code.toLowerCase() &&
					c.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('failureCode.err.codeTaken', { code })
				: '';
		}
		else if (kind == 'failureGroup') {
			const groupCode = this.form.groupCode?.trim();

			if (!groupCode) {
				return this.i18n.t('failureGroup.err.groupCodeRequired');
			}

			if (!this.form.groupName) {
				return this.i18n.t('failureGroup.err.groupNameRequired');
			}

			if (!this.form.sortOrder || this.form.sortOrder <= 0) {
				return this.i18n.t('failureGroup.err.sortOrderRequired');
			}

			const clash = this.groups().find(
				group =>
					group.groupCode?.toLowerCase() === groupCode.toLowerCase() &&
					group.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('failureGroup.err.groupCodeTaken', { groupCode })
				: '';
		}
		return '';

	}



	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
		if (kind == 'failureCode') {
			const body: FailureCodeRequest = {
				code: this.form.code,
				name: this.form.name,
				shortName: this.form.shortName ?? null,
				description: this.form.description ?? null,
				failureGroupId: this.form.failureGroupId ?? null,
				severity: this.form.severity,
				isActive: this.form.isActive ?? true,
			};
			return id ? this.failureCodeApi.update(id, body) : this.failureCodeApi.create(body);
		}
		else if (kind == 'failureGroup') {
			const body: FailureGroupRequest = {
				groupCode: this.form.groupCode,
				groupName: this.form.groupName,
				shortName: this.form.shortName ?? null,
				description: this.form.description ?? null,
				sortOrder: this.form.sortOrder,
				isActive: this.form.isActive,
			};
			return id ? this.failureGroupApi.update(id, body) : this.failureGroupApi.create(body);
		}
		return null;
	}

	private _nextSortOrder(): number {
		const maxSortOrder = Math.max(
			0,
			...this.failureGroupApi
				.items()
				.map(x => x.sortOrder ?? 0)
		);
		return maxSortOrder + 1;
	}

	private _nextFailureCode(): string {
		let code = "";

		const prefixCode = "FC_";
		const maxCode = Math.max(
			0,
			...this.failureCodeApi.items()
				.filter(x => x.code?.startsWith(prefixCode))
				.map(x => parseInt(x.code?.replace(prefixCode, '') ?? '0'))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}

	private _nextGroupCode(): string {
		let code = "";

		const prefixCode = "FG_";
		const maxCode = Math.max(
			0,
			...this.failureGroupApi.items()
				.filter(x => x.groupCode?.startsWith(prefixCode))
				.map(x => parseInt(x.groupCode?.replace(prefixCode, '') ?? '0'))
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
