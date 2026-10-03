import { CommonModule } from '@angular/common';
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
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { DefectApiService, DefectGroupApiService } from '../../core/services/quality-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { DEFECT_SEVERITY, DefectDto, DefectGroupDto, DefectGroupRequest, DefectRequest, defectSeverityOf } from '../../domain/models/quality.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'defect' | 'defectGroup';

interface EntityForm {
	defectGroupId?: number | null;
	defectCode?: string | null;
	defectName?: string | null;
	shortName?: string | null;
	description?: string | null;
	severity?: number | null;
	sortOrder?: number | null;
	isActive?: boolean | null;

	groupCode?: string | null,
	groupName?: string | null,
}

const LABEL_KEYS: Record<EntityKind, string> = {
	defectGroup: 'defectGroup.lower',
	defect: 'defect.lower',
};

@Component({
	selector: 'app-defect',
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
	templateUrl: './defect.component.html',
	styleUrl: './defect.component.scss',
})
export class DefectComponent extends PermissionAwarePage implements OnInit {
	private readonly defectApi = inject(DefectApiService);
	private readonly defectGroupApi = inject(DefectGroupApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	readonly severityOf = defectSeverityOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────
	groupLabel(id?: number | null): string {
		if (id == null) return '';
		const defectGroup = this.defectGroupApi.items().find(u => u.id === id);
		return defectGroup ? `${defectGroup.groupCode} · ${defectGroup.groupName}` : '';
	}

	severityLabel(id?: number | null): string {
		if (id == null) return '';
		const severity = DEFECT_SEVERITY.find(u => u.value === id);
		return severity ? this.i18n.t(severity.labelKey) : '';
	}

	readonly groupOptions = computed(() =>
		this.defectGroupApi.items().map(u => ({ label: `${u.groupCode} · ${u.groupName}`, value: u.id })));

	readonly severityOptions = computed(() =>
		DEFECT_SEVERITY.map(u => ({ label: this.i18n.t(u.labelKey), value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedDefect = signal<DefectDto | null>(null);
	readonly selectedGroup = signal<DefectGroupDto | null>(null);



	readonly groups = computed(() => {
		const all = this.defectGroupApi.items();
		return all;
	});

	readonly defects = computed(() => {
		const id = this.selectedGroup()?.id;
		if (id == null) return [];
		const all = this.defectApi.items().filter(d => d.defectGroupId === id);
		return all;
	});


	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly defectTable = viewChild<Table>('defectTable');
	private readonly groupTable = viewChild<Table>('groupTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		defect: [''],
		defectGroup: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			defect: this.defectTable(),
			defectGroup: this.groupTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'defect') {
			this.selectedDefect.set(this._reconcile(this.selectedDefect(), visible as DefectDto[]));
		} else if (kind === 'defectGroup') {
			this.selectedGroup.set(this._reconcile(this.selectedGroup(), visible as DefectGroupDto[]));
		}
	}

	selectDefect(defect: DefectDto): void {
		if (this.selectedDefect()?.id === defect.id) return;
		this.selectedDefect.set(defect);
	}

	selectGroup(group: DefectGroupDto): void {
		if (this.selectedGroup()?.id === group.id) return;
		this.selectedGroup.set(group);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.defect);

		effect(() => {
			const defects = this.defects();
			untracked(() => this.selectedDefect.set(this._reconcile(this.selectedDefect(), defects)));
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
			defects: this.defectApi.load(),
			defectGroups: this.defectGroupApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('defect.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly dialogKind = signal<EntityKind>('defectGroup');
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
			defectGroupId: this.selectedGroup()?.id,
			sortOrder: kind === 'defectGroup' ? this._nextSortOrderGroup() : this._nextSortOrderDefect(this.selectedGroup()?.id ?? 0),
			defectCode: kind === 'defect' ? this._nextDefectCode() : null,
			groupCode: kind === 'defectGroup' ? this._nextGroupCode() : null
		};

		this.dialogOpen.set(true);
	}

	openEdit(kind: EntityKind): void {
		const row = {
			defectGroup: this.selectedGroup(), defect: this.selectedDefect(),
		}[kind];
		if (!row) return;

		this.dialogKind.set(kind);
		this.editingId.set(row.id);
		this.formError.set('');

		if (kind === 'defect') {
			const d = row as DefectDto;
			this.form = {
				...this._emptyForm(),
				defectGroupId: d.defectGroupId ?? 0,
				defectCode: d.defectCode ?? '',
				defectName: d.defectName ?? '',
				shortName: d.shortName ?? null,
				description: d.description ?? null,
				severity: d.severity ?? 1,
				sortOrder: d.sortOrder ?? 1,
				isActive: d.isActive ?? true,
			};
		} else {
			const d = row as DefectGroupDto;
			this.form = {
				...this._emptyForm(),
				groupCode: d.groupCode ?? '',
				groupName: d.groupName ?? '',
				shortName: d.shortName ?? null,
				description: d.description ?? null,
				sortOrder: d.sortOrder ?? 1,
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
		const row = kind === 'defect'
			? this.selectedDefect()
			: this.selectedGroup();

		if (!row) return;

		const label = kind === 'defect'
			? (row as DefectDto).defectCode
			: (row as DefectGroupDto).groupCode;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t(kind === 'defect' ? 'defect.lower' : 'defectGroup.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => (kind === 'defect' ? this.defectApi.remove(row.id) : this.defectGroupApi.remove(row.id)).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t(kind === 'defect' ? 'defect.lower' : 'defectGroup.lower') }), err),
			}),
		});
	}

	onGroupChange(groupId: number | null): void {
		if (this.form.sortOrder !== 0) return;
		this.form.sortOrder = this._nextSortOrderDefect(groupId ?? 0);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm(): EntityForm {
		return {
			defectGroupId: null as number | null,
			defectCode: null as string | null,
			defectName: null as string | null,
			shortName: null as string | null,
			description: null as string | null,
			severity: 1 as number | null,
			sortOrder: 0 as number | null,
			isActive: true as boolean | null,

			groupCode: null as string | null,
			groupName: null as string | null,
		};
	}

	private _validate(kind: EntityKind): string {
		if (kind == 'defect') {
			const defectCode = this.form.defectCode?.trim();

			if (!defectCode) {
				return this.i18n.t('defect.err.defectCodeRequired');
			}

			if (!this.form.defectName) {
				return this.i18n.t('defect.err.defectNameRequired');
			}

			if (!this.form.defectGroupId || this.form.defectGroupId <= 0) {
				return this.i18n.t('defect.err.defectGroupIdRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.defects().find(
				defect =>
					defect.defectCode?.toLowerCase() === defectCode.toLowerCase() &&
					defect.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('defect.err.defectCodeTaken', { defectCode })
				: '';
		}
		else if (kind == 'defectGroup') {
			const groupCode = this.form.groupCode?.trim();

			if (!groupCode) {
				return this.i18n.t('defectGroup.err.groupCodeRequired');
			}

			if (!this.form.groupName) {
				return this.i18n.t('defectGroup.err.groupNameRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.groups().find(
				group =>
					group.groupCode?.toLowerCase() === groupCode.toLowerCase() &&
					group.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('defectGroup.err.groupCodeTaken', { groupCode })
				: '';
		}
		return '';

	}



	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
		if (kind == 'defect') {
			const body: DefectRequest = {
				defectGroupId: this.form.defectGroupId,
				defectCode: this.form.defectCode,
				defectName: this.form.defectName,
				shortName: this.form.shortName ?? null,
				description: this.form.description ?? null,
				severity: this.form.severity,
				sortOrder: this.form.sortOrder,
				isActive: this.form.isActive,
			};
			return id ? this.defectApi.update(id, body) : this.defectApi.create(body);
		}
		else if (kind == 'defectGroup') {
			const body: DefectGroupRequest = {
				groupCode: this.form.groupCode,
				groupName: this.form.groupName,
				shortName: this.form.shortName ?? null,
				description: this.form.description ?? null,
				sortOrder: this.form.sortOrder,
				isActive: this.form.isActive,
			};
			return id ? this.defectGroupApi.update(id, body) : this.defectGroupApi.create(body);
		}
		return null;
	}


	private _nextSortOrderDefect(defectGroupId: number | null): number {
		if (!defectGroupId) return 0;
		const maxSortOrder = Math.max(
			0,
			...this.defectApi
				.items()
				.filter(x => x.defectGroupId === defectGroupId)
				.map(x => x.sortOrder ?? 0)
		);
		return maxSortOrder + 1;
	}
	private _nextSortOrderGroup(): number {
		const maxSortOrder = Math.max(
			0,
			...this.defectGroupApi
				.items()
				.map(x => x.sortOrder ?? 0)
		);
		return maxSortOrder + 1;
	}

	private _nextDefectCode(): string {
		let code = "";

		const prefixCode = "D_";
		const maxCode = Math.max(
			0,
			...this.defectApi.items()
				.filter(x => x.defectCode?.startsWith(prefixCode))
				.map(x => parseInt(x.defectCode?.replace(prefixCode, '') ?? '0'))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}
	private _nextGroupCode(): string {
		let code = "";

		const prefixCode = "DG_";
		const maxCode = Math.max(
			0,
			...this.defectGroupApi.items()
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
