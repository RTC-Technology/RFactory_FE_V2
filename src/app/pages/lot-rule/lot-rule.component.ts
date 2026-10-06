import { CommonModule, formatDate } from '@angular/common';
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
import { I18nService } from '../../core/services/i18n.service';
import { LotRuleApiService, LotRuleSequenceApiService, ProductLotRuleApiService } from '../../core/services/master-data-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { LOT_RULE_SEQUENCE_RESET_TYPES, LOT_RULE_STATUS, LotRuleDto, LotRuleRequest, LotRuleSequenceDto, lotRuleStatusOf, ProductLotRuleDto } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { productStatusOf } from '../../domain/models/product.model';

type EntityKind = 'lotRule' | 'lotRuleSequence' | 'productLotRule';
const DATETIME_LOCAL = "yyyy-MM-dd";
interface ProductOption {
	value: number;
	label: string;
	code: string;
	name: string;
	unit: string;
	drawingNo: string;
	statusLabel: string;
	statusSeverity: 'success' | 'danger' | undefined;
}
@Component({
	selector: 'app-lot-rule',
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
	templateUrl: './lot-rule.component.html',
	styleUrl: './lot-rule.component.scss',
})
export class LotRuleComponent extends PermissionAwarePage implements OnInit {
	private readonly lotRuleApi = inject(LotRuleApiService);
	private readonly lotRuleSequenceApi = inject(LotRuleSequenceApiService);
	private readonly productLotRuleApi = inject(ProductLotRuleApiService);

	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	statusSeverity = lotRuleStatusOf

	// ─── Lookups ────────────────────────────────────────────────────────────────
	statusLabel(value?: number | null): string {
		if (value == null) return '';
		const status = LOT_RULE_STATUS.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	resetTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = LOT_RULE_SEQUENCE_RESET_TYPES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	readonly statusOptions = computed(() =>
		LOT_RULE_STATUS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly resetTypeOptions = computed(() =>
		LOT_RULE_SEQUENCE_RESET_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly productOptions = computed<ProductOption[]>(() => {
		const units = new Map(this.unitApi.items().map(u => [u.id, u.symbol || u.unitCode]));
		return this.productApi.items().map(p => {
			const status = productStatusOf(p.status);
			return {
				value: p.id,
				label: `${p.productCode} · ${p.productName}`,
				code: p.productCode,
				name: p.productName,
				unit: (p.defaultUnitId != null ? units.get(p.defaultUnitId) : '') ?? '',
				drawingNo: p.drawingNo ?? '',
				statusLabel: status ? this.i18n.t(status.labelKey) : '',
				statusSeverity: status?.severity,
			};
		});
	});

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedLotRule = signal<LotRuleDto | null>(null);
	readonly selectedSequence = signal<LotRuleSequenceDto | null>(null);
	readonly selectedProduct = signal<ProductLotRuleDto | null>(null);

	readonly lotRules = computed(() => {
		const all = this.lotRuleApi.items();
		return all;
	});

	readonly sequences = computed(() => {
		const id = this.selectedLotRule()?.id;
		if (id == null) return [];
		return this.lotRuleSequenceApi.items().filter(e => e.lotRuleId === id);
	});

	readonly productLotRules = computed(() => {
		const id = this.selectedLotRule()?.id;
		if (id == null) return [];
		return this.productLotRuleApi.items().filter(e => e.lotRuleId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly lotRuleTable = viewChild<Table>('lotRuleTable');
	private readonly lotRuleSequenceTable = viewChild<Table>('lotRuleSequenceTable');
	private readonly productLotRuleTable = viewChild<Table>('productLotRuleTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		lotRule: [''],
		lotRuleSequence: [''],
		productLotRule: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			lotRule: this.lotRuleTable(),
			lotRuleSequence: this.lotRuleSequenceTable(),
			productLotRule: this.productLotRuleTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'lotRule') {
			this.selectedLotRule.set(this._reconcile(this.selectedLotRule(), visible as LotRuleDto[]));
		} else if (kind === 'lotRuleSequence') {
			this.selectedSequence.set(this._reconcile(this.selectedSequence(), visible as LotRuleSequenceDto[]));
		} else if (kind === 'productLotRule') {
			this.selectedProduct.set(this._reconcile(this.selectedProduct(), visible as ProductLotRuleDto[]));
		}
	}

	selectLotRule(lotRule: LotRuleDto): void {
		if (this.selectedLotRule()?.id === lotRule.id) return;
		this.selectedLotRule.set(lotRule);
	}

	selectSequence(sequence: LotRuleSequenceDto): void {
		if (this.selectedSequence()?.id === sequence.id) return;
		this.selectedSequence.set(sequence);
	}

	selectProduct(product: ProductLotRuleDto): void {
		if (this.selectedProduct()?.id === product.id) return;
		this.selectedProduct.set(product);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.lotRule);

		effect(() => {
			const lotRules = this.lotRules();
			untracked(() => this.selectedLotRule.set(this._reconcile(this.selectedLotRule(), lotRules)));
		});

		effect(() => {
			const sequences = this.sequences();
			untracked(() => this.selectedSequence.set(this._reconcile(this.selectedSequence(), sequences)));
		});

		effect(() => {
			const productLotRules = this.productLotRules();
			untracked(() => this.selectedProduct.set(this._reconcile(this.selectedProduct(), productLotRules)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			lotRules: this.lotRuleApi.load(),
			sequences: this.lotRuleSequenceApi.load(),
			productLotRules: this.productLotRuleApi.load(),

			products: this.productApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('lotRule.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly productRows = signal<ProductLotRuleDto[]>([]);

	private _tempItemId = 0;

	activeTab = 'lotRule';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('lotRule.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), ruleCode: this._nextCode() };
		this.productRows.set([this._emptyProductRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedLotRule();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			ruleCode: row.ruleCode,
			ruleName: row.ruleName,
			template: row.template,
			prefix: row.prefix,
			dateFormat: row.dateFormat,
			sequenceLength: row.sequenceLength ?? null,
			sequenceResetType: row.sequenceResetType,
			status: row.status,
			description: row.description ?? null,
		};

		this.productRows.set(
			this.productLotRuleApi.items()
				.filter(d => d.lotRuleId === row.id)
				.map(d => ({
					...d,
					effectiveFrom: this._toLocalInput(d.effectiveFrom),
					effectiveTo: this._toLocalInput(d.effectiveTo),
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
					entity: this.i18n.t('lotRule.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('lotRule.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedLotRule();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('lotRule.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.ruleName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.lotRuleApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.ruleName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('lotRule.lower') }), err),
			}),
		});
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addProductRow(): void {
		this.productRows.update(rows => [...rows, this._emptyProductRow()]);
	}

	removeProductRow(row: ProductLotRuleDto): void {
		this.productRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			ruleCode: '',
			ruleName: '',
			template: '',
			prefix: '',
			dateFormat: '',
			sequenceLength: 2 as number | null,
			sequenceResetType: 1,
			status: 1,
			description: null as string | null,
		};
	}

	private _emptyProductRow() {
		return {
			id: this._tempItemId--,
			productId: null as number | null,
			lotRuleId: null as number | null,
			isDefault: false as boolean | null,
			effectiveFrom: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			effectiveTo: null as string | null,
		};
	}


	private _validate(): string {
		const ruleCode = this.form.ruleCode.trim();

		if (!ruleCode) {
			return this.i18n.t('lotRule.err.ruleCodeRequired');
		}

		if (!this.form.ruleName) {
			return this.i18n.t('lotRule.err.ruleNameRequired');
		}

		if (!this.form.template) {
			return this.i18n.t('lotRule.err.templateRequired');
		}

		if (!this.form.prefix) {
			return this.i18n.t('lotRule.err.prefixRequired');
		}

		if (!this.form.dateFormat) {
			return this.i18n.t('lotRule.err.dateFormatRequired');
		}

		const clash = this.lotRules().find(
			rule =>
				rule.ruleCode.toLowerCase() === ruleCode.toLowerCase() &&
				rule.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('lotRule.err.ruleCodeTaken', { ruleCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<LotRuleDto> {
		const body: LotRuleRequest = {
			ruleCode: this.form.ruleCode,
			ruleName: this.form.ruleName,
			template: this.form.template,
			prefix: this.form.prefix,
			dateFormat: this.form.dateFormat,
			sequenceLength: this.form.sequenceLength ?? null,
			sequenceResetType: this.form.sequenceResetType,
			status: this.form.status,
			description: this.form.description ?? null,
			productLotRules: this.productRows().map((r) => ({
				id: r.id > 0 ? r.id : 0,
				productId: r.productId ?? null,
				lotRuleId: r.lotRuleId ?? null,
				isDefault: r.isDefault ?? null,
				effectiveFrom: r.effectiveFrom ?? null,
				effectiveTo: r.effectiveTo ?? null,
			}))
		};
		return id ? this.lotRuleApi.update(id, body) : this.lotRuleApi.create(body);
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "LR_";
		const maxCode = Math.max(
			0,
			...this.lotRuleApi.items()
				.filter(x => x.ruleCode.startsWith(prefixCode))
				.map(x => parseInt(x.ruleCode.replace(prefixCode, '')))
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
