import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { MaintenanceChecklistApiService, MaintenanceChecklistItemApiService } from '../../core/services/master-data-api.service';
import { UnitApiService } from '../../core/services/product-api.service';
import { MAINTENANCE_CHECKLIST_STATUS, MAINTENANCE_CHECKLIST_TYPE, MaintenanceChecklistDto, MaintenanceChecklistItemDto, MaintenanceChecklistRequest, statusOf } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'maintenanceChecklist' | 'maintenanceChecklistItem';

@Component({
	selector: 'app-maintenance-checklist',
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
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './maintenance-checklist.component.html',
	styleUrl: './maintenance-checklist.component.scss',
})
export class MaintenanceChecklistComponent extends PermissionAwarePage implements OnInit {

	readonly checklistApi = inject(MaintenanceChecklistApiService);
	readonly checklistItemApi = inject(MaintenanceChecklistItemApiService);

	readonly unitApi = inject(UnitApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	statusSeverity = statusOf
	// ─── Lookups ────────────────────────────────────────────────────────────────
	statusLabel(value?: number | null): string {
		if (value == null) return '';
		const type = MAINTENANCE_CHECKLIST_STATUS.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	typeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = MAINTENANCE_CHECKLIST_TYPE.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	unitLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? `${unit.unitCode} · ${unit.unitName}` : '';
	}

	readonly statusOptions = computed(() =>
		MAINTENANCE_CHECKLIST_STATUS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly typeOptions = computed(() =>
		MAINTENANCE_CHECKLIST_TYPE.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedChecklist = signal<MaintenanceChecklistDto | null>(null);
	readonly selectedItem = signal<MaintenanceChecklistItemDto | null>(null);

	readonly checklists = computed(() => {
		const all = this.checklistApi.items();
		return all;
	});

	readonly items = computed(() => {
		const id = this.selectedChecklist()?.id;
		if (id == null) return [];
		const all = this.checklistItemApi.items().filter(r => r.maintenanceChecklistId === id);
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly checklistTable = viewChild<Table>('checklistTable');
	private readonly itemTable = viewChild<Table>('itemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		maintenanceChecklist: [''],
		maintenanceChecklistItem: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			maintenanceChecklist: this.checklistTable(),
			maintenanceChecklistItem: this.itemTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'maintenanceChecklist') {
			this.selectedChecklist.set(this._reconcile(this.selectedChecklist(), visible as MaintenanceChecklistDto[]));
		} else if (kind === 'maintenanceChecklistItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as MaintenanceChecklistItemDto[]));
		}
	}

	selectChecklist(checklist: MaintenanceChecklistDto): void {
		if (this.selectedChecklist()?.id === checklist.id) return;
		this.selectedChecklist.set(checklist);
	}
	selectItem(item: MaintenanceChecklistItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.maintenanceChecklist);

		effect(() => {
			const checklists = this.checklists();
			untracked(() => this.selectedChecklist.set(this._reconcile(this.selectedChecklist(), checklists)));
		});
		effect(() => {
			const items = this.items();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			checklists: this.checklistApi.load(),
			checklistItems: this.checklistItemApi.load(),
			units: this.unitApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('maintenanceChecklist.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly itemRows = signal<MaintenanceChecklistItemDto[]>([]);
	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('maintenanceChecklist.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), checklistCode: this._nextCode() };
		this.itemRows.set([this._emptyItemRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedChecklist();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			checklistCode: row.checklistCode,
			checklistName: row.checklistName,
			description: row.description ?? null,
			version: row.version,
			status: row.status,
		};

		this.itemRows.set(
			this.checklistItemApi.items()
				.filter(d => d.maintenanceChecklistId === row.id)
				.map(d => ({
					...d,
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
					entity: this.i18n.t('maintenanceChecklist.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('maintenanceChecklist.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedChecklist();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('maintenanceChecklist.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.checklistName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.checklistApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.checklistName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('maintenanceChecklist.lower') }), err),
			}),
		});
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
	}

	removeItemRow(row: MaintenanceChecklistItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			checklistCode: "",
			checklistName: "",
			description: null as string | null,
			version: 1,
			status: 1,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			maintenanceChecklistId: null as number | null,
			sequenceNo: 0,
			itemCode: this._nextItemCode(),
			itemName: "",
			checkType: 1,
			unitId: null as number | null,
			targetValue: null as number | null,
			minValue: null as number | null,
			maxValue: null as number | null,
			expectedResult: null as string | null,
			isRequired: true as boolean | null,
			isActive: true as boolean | null,
		};
	}

	private _validate(): string {
		const checklistCode = this.form.checklistCode.trim();

		if (!checklistCode) {
			return this.i18n.t('maintenanceChecklist.err.checklistCodeRequired');
		}

		if (!this.form.checklistName) {
			return this.i18n.t('maintenanceChecklist.err.checklistNameRequired');
		}
		if (!this.form.version || this.form.version == 0) {
			return this.i18n.t('maintenanceChecklist.err.versionRequired');
		}

		const clash = this.checklists().find(
			checklist =>
				checklist.checklistCode.toLowerCase() === checklistCode.toLowerCase() &&
				checklist.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('maintenanceChecklist.err.checklistCodeTaken', { checklistCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<MaintenanceChecklistDto> {
		const body: MaintenanceChecklistRequest = {
			checklistCode: this.form.checklistCode,
			checklistName: this.form.checklistName,
			description: this.form.description ?? null,
			version: this.form.version,
			status: this.form.status,
			maintenanceChecklistItems: this.itemRows().map((r, key) => ({
				id: r.id > 0 ? r.id : 0,
				maintenanceChecklistId: r.maintenanceChecklistId ?? null,
				sequenceNo: key + 1,
				itemCode: r.itemCode,
				itemName: r.itemName,
				checkType: r.checkType ?? null,
				unitId: r.unitId ?? null,
				targetValue: r.targetValue ?? null,
				minValue: r.minValue ?? null,
				maxValue: r.maxValue ?? null,
				expectedResult: r.expectedResult ?? null,
				isRequired: r.isRequired ?? true,
				isActive: r.isActive ?? true,
			}))
		};
		return id ? this.checklistApi.update(id, body) : this.checklistApi.create(body);
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "CL_";
		const maxCode = Math.max(
			0,
			...this.checklistApi.items()
				.filter(x => x.checklistCode.startsWith(prefixCode))
				.map(x => parseInt(x.checklistCode.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}

	private _nextItemCode(): string {
		let code = "";

		const prefixCode = "ITM_";
		const maxCode = Math.max(
			0,
			...this.itemRows()
				.filter(x => x.itemCode.startsWith(prefixCode))
				.map(x => parseInt(x.itemCode.replace(prefixCode, '')))
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
