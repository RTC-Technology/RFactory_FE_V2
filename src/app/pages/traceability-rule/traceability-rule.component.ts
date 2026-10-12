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
import { TraceabilityRuleApiService, TraceabilityRuleItemApiService, TraceabilityTypeApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { TRACEABILITY_DIRECTION, TraceabilityRuleDto, TraceabilityRuleItemDto, TraceabilityRuleRequest } from '../../domain/models/master-data.model';
import { productStatusOf } from '../../domain/models/product.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CheckboxModule } from 'primeng/checkbox';

type EntityKind = 'traceabilityRule' | 'traceabilityRuleItem';
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
	selector: 'app-traceability-rule',
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
	templateUrl: './traceability-rule.component.html',
	styleUrl: './traceability-rule.component.scss',
})
export class TraceabilityRuleComponent extends PermissionAwarePage implements OnInit {
	private readonly traceRuleApi = inject(TraceabilityRuleApiService);
	private readonly traceItemApi = inject(TraceabilityRuleItemApiService);
	private readonly traceTypeApi = inject(TraceabilityTypeApiService);

	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	directionLabel(value?: number | null): string {
		if (value == null) return '';
		const type = TRACEABILITY_DIRECTION.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	typeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = this.traceTypeApi.items().find(u => u.id === id);
		return type ? `${type.traceCode} · ${type.traceName}` : '';
	}

	readonly directionOptions = computed(() =>
		TRACEABILITY_DIRECTION.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

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

	readonly typeOptions = computed(() =>
		this.traceTypeApi.items().map(u => ({ label: `${u.traceCode} · ${u.traceName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedRule = signal<TraceabilityRuleDto | null>(null);
	readonly selectedItem = signal<TraceabilityRuleItemDto | null>(null);

	readonly traceRules = computed(() => {
		const all = this.traceRuleApi.items();
		return all;
	});

	readonly traceItems = computed(() => {
		const id = this.selectedRule()?.id;
		if (id == null) return [];
		const all = this.traceItemApi.items().filter(r => r.traceabilityRuleId === id);
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly ruleTable = viewChild<Table>('ruleTable');
	private readonly itemTable = viewChild<Table>('itemTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		traceabilityRule: [''],
		traceabilityRuleItem: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			traceabilityRule: this.ruleTable(),
			traceabilityRuleItem: this.itemTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'traceabilityRule') {
			this.selectedRule.set(this._reconcile(this.selectedRule(), visible as TraceabilityRuleDto[]));
		} else if (kind === 'traceabilityRuleItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as TraceabilityRuleItemDto[]));
		}
	}

	selectRule(rule: TraceabilityRuleDto): void {
		if (this.selectedRule()?.id === rule.id) return;
		this.selectedRule.set(rule);
	}
	selectItem(item: TraceabilityRuleItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.traceabilityRule);

		effect(() => {
			const rules = this.traceRules();
			untracked(() => this.selectedRule.set(this._reconcile(this.selectedRule(), rules)));
		});
		effect(() => {
			const items = this.traceItems();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			traceRules: this.traceRuleApi.load(),
			traceItems: this.traceItemApi.load(),
			traceTypes: this.traceTypeApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('traceabilityRule.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly itemRows = signal<TraceabilityRuleItemDto[]>([]);
	private _tempItemId = 0;
	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('traceabilityRule.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), ruleCode: this._nextCode() };
		this.itemRows.set([this._emptyItemRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedRule();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			ruleCode: row.ruleCode,
			ruleName: row.ruleName,
			productId: row.productId ?? null,
			traceDirection: row.traceDirection,
			isActive: row.isActive ?? true,
			description: row.description ?? null,
		};

		this.itemRows.set(
			this.traceItemApi.items()
				.filter(d => d.traceabilityRuleId === row.id)
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
					entity: this.i18n.t('traceabilityRule.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('traceabilityRule.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedRule();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('traceabilityRule.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.ruleName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.traceRuleApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.ruleName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('traceabilityRule.lower') }), err),
			}),
		});
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
	}

	removeItemRow(row: TraceabilityRuleItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			ruleCode: '',
			ruleName: '',
			productId: null as number | null,
			traceDirection: 3,
			isActive: true as boolean | null,
			description: null as string | null,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			traceabilityRuleId: null as number | null,
			traceTypeId: 0,
			isRequired: true as boolean | null,
			sortOrder: 0,
			description: null as string | null,
		};
	}

	private _validate(): string {
		const ruleCode = this.form.ruleCode.trim();

		if (!ruleCode) {
			return this.i18n.t('traceabilityRule.err.ruleCodeRequired');
		}

		if (!this.form.ruleName) {
			return this.i18n.t('traceabilityRule.err.ruleNameRequired');
		}

		const clash = this.traceRules().find(
			rule =>
				rule.ruleCode.toLowerCase() === ruleCode.toLowerCase() &&
				rule.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('traceabilityRule.err.ruleCodeTaken', { ruleCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<TraceabilityRuleDto> {
		const body: TraceabilityRuleRequest = {
			ruleCode: this.form.ruleCode,
			ruleName: this.form.ruleName,
			productId: this.form.productId ?? null,
			traceDirection: this.form.traceDirection,
			isActive: this.form.isActive ?? true,
			description: this.form.description ?? null,
			traceabilityRuleItems: this.itemRows().map((r, key) => ({
				id: r.id > 0 ? r.id : 0,
				traceabilityRuleId: r.traceabilityRuleId ?? null,
				traceTypeId: r.traceTypeId,
				isRequired: r.isRequired ?? true,
				sortOrder: key + 1,
				description: r.description ?? null,
			}))
		};
		return id ? this.traceRuleApi.update(id, body) : this.traceRuleApi.create(body);
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "TR_";
		const maxCode = Math.max(
			0,
			...this.traceRuleApi.items()
				.filter(x => x.ruleCode.startsWith(prefixCode))
				.map(x => parseInt(x.ruleCode.replace(prefixCode, '')))
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
