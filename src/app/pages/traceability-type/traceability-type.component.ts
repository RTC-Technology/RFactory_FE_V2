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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { TraceabilityTypeApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { TraceabilityTypeDto, TraceabilityTypeRequest } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'traceabilityType';

@Component({
	selector: 'app-traceability-type',
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
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './traceability-type.component.html',
	styleUrl: './traceability-type.component.scss',
})
export class TraceabilityTypeComponent extends PermissionAwarePage implements OnInit {
	private readonly traceabilityTypeApi = inject(TraceabilityTypeApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────


	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedType = signal<TraceabilityTypeDto | null>(null);

	readonly types = computed(() => {
		const all = this.traceabilityTypeApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly typeTable = viewChild<Table>('table');

	readonly filterFields: Record<EntityKind, string[]> = {
		traceabilityType: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			traceabilityType: this.typeTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'traceabilityType') {
			this.selectedType.set(this._reconcile(this.selectedType(), visible as TraceabilityTypeDto[]));
		}
	}

	selectType(type: TraceabilityTypeDto): void {
		if (this.selectedType()?.id === type.id) return;
		this.selectedType.set(type);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.traceabilityType);

		effect(() => {
			const types = this.types();
			untracked(() => this.selectedType.set(this._reconcile(this.selectedType(), types)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			traceabilityTypes: this.traceabilityTypeApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('traceabilityType.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('traceabilityType.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), sortOrder: this._nextSortOrder(), traceCode: this._nextCode() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedType();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			sortOrder: row.sortOrder,
			traceCode: row.traceCode,
			traceName: row.traceName,
			isActive: row.isActive ?? true,
			description: row.description ?? null,
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
					entity: this.i18n.t('traceabilityType.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('traceabilityType.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedType();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('traceabilityType.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.traceName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.traceabilityTypeApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.traceName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('traceabilityType.lower') }), err),
			}),
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			sortOrder: 0,
			traceCode: '',
			traceName: '',
			isActive: true as boolean | null,
			description: null as string | null,
		};
	}

	private _validate(): string {
		const traceCode = this.form.traceCode.trim();

		if (!traceCode) {
			return this.i18n.t('traceabilityType.err.traceCodeRequired');
		}

		if (!this.form.traceName) {
			return this.i18n.t('traceabilityType.err.traceNameRequired');
		}

		const clash = this.types().find(
			type =>
				type.traceCode.toLowerCase() === traceCode.toLowerCase() &&
				type.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('traceabilityType.err.traceCodeTaken', { traceCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<TraceabilityTypeDto> {
		const body: TraceabilityTypeRequest = {
			sortOrder: this.form.sortOrder,
			traceCode: this.form.traceCode,
			traceName: this.form.traceName,
			isActive: this.form.isActive ?? true,
			description: this.form.description ?? null,
		};
		return id ? this.traceabilityTypeApi.update(id, body) : this.traceabilityTypeApi.create(body);
	}

	private _nextSortOrder(): number {
		const maxSortOrder = Math.max(
			0,
			...this.traceabilityTypeApi
				.items()
				.map(x => x.sortOrder ?? 0)
		);
		return maxSortOrder + 1;
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "TT_";
		const maxCode = Math.max(
			0,
			...this.traceabilityTypeApi.items()
				.filter(x => x.traceCode.startsWith(prefixCode))
				.map(x => parseInt(x.traceCode.replace(prefixCode, '')))
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
