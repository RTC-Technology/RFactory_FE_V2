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
import { CurrencyApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { CurrencyDto, CurrencyRequest } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'currency';

@Component({
	selector: 'app-currency',
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
		TagModule,
		TabsModule,
		CheckboxModule,
		ToggleButtonModule,
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './currency.component.html',
	styleUrl: './currency.component.scss',
})
export class CurrencyComponent extends PermissionAwarePage implements OnInit {
	private readonly currencyApi = inject(CurrencyApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCurrency = signal<CurrencyDto | null>(null);

	readonly currencies = computed(() => {
		const all = this.currencyApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly currencyTable = viewChild<Table>('table');

	readonly filterFields: Record<EntityKind, string[]> = {
		currency: ['currencyCode', 'currencyName', 'currencySymbol'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			currency: this.currencyTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'currency') {
			this.selectedCurrency.set(this._reconcile(this.selectedCurrency(), visible as CurrencyDto[]));
		}
	}

	selectCurrency(currency: CurrencyDto): void {
		if (this.selectedCurrency()?.id === currency.id) return;
		this.selectedCurrency.set(currency);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.currency);

		effect(() => {
			const currencies = this.currencies();
			untracked(() => this.selectedCurrency.set(this._reconcile(this.selectedCurrency(), currencies)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			currencies: this.currencyApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('currency.err.load'), err),
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
			entity: this.i18n.t('currency.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), sortOrder: this._nextSortOrder() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedCurrency();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			currencyCode: row.currencyCode,
			currencyName: row.currencyName,
			currencySymbol: row.currencySymbol,
			decimalPlaces: row.decimalPlaces,
			isBaseCurrency: row.isBaseCurrency ?? true,
			isActive: row.isActive ?? true,
			sortOrder: row.sortOrder ?? this._nextSortOrder(),
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
					entity: this.i18n.t('currency.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('currency.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedCurrency();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('currency.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.currencyName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.currencyApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.currencyName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('currency.lower') }), err),
			}),
		});
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			currencyCode: '',
			currencyName: '',
			currencySymbol: '',
			decimalPlaces: 0,
			isBaseCurrency: false,
			isActive: true,
			sortOrder: 0,
		};
	}

	private _validate(): string {
		const currencyCode = this.form.currencyCode.trim();

		if (!currencyCode) {
			return this.i18n.t('currency.err.currencyCodeRequired');
		}

		if (!this.form.currencyName) {
			return this.i18n.t('currency.err.currencyNameRequired');
		}

		const clash = this.currencies().find(
			currency =>
				currency.currencyCode.toLowerCase() === currencyCode.toLowerCase() &&
				currency.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('currency.err.currencyCodeTaken', { currencyCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<CurrencyDto> {
		const body: CurrencyRequest = {
			currencyCode: this.form.currencyCode,
			currencyName: this.form.currencyName,
			currencySymbol: this.form.currencySymbol,
			decimalPlaces: this.form.decimalPlaces,
			isBaseCurrency: this.form.isBaseCurrency,
			isActive: this.form.isActive ?? true,
			sortOrder: this.form.sortOrder,
		};
		return id ? this.currencyApi.update(id, body) : this.currencyApi.create(body);
	}

	private _nextSortOrder(): number {
		const maxSortOrder = Math.max(
			0,
			...this.currencyApi
				.items()
				.map(x => x.sortOrder ?? 0)
		);
		return maxSortOrder + 1;
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
