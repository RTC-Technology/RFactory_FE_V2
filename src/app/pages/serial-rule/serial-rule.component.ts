import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { CommonModule, formatDate } from '@angular/common';
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
import { SerialRuleApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { SERIAL_RULE_SEQUENCE_RESET_TYPES, SerialRuleDto, SerialRuleRequest } from '../../domain/models/master-data.model';
import { productStatusOf } from '../../domain/models/product.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'serialRule';
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
	selector: 'app-serial-rule',
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
	templateUrl: './serial-rule.component.html',
	styleUrl: './serial-rule.component.scss',
})
export class SerialRuleComponent extends PermissionAwarePage implements OnInit {
	private readonly serialRuleApi = inject(SerialRuleApiService);

	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────

	resetTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = SERIAL_RULE_SEQUENCE_RESET_TYPES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	readonly resetTypeOptions = computed(() =>
		SERIAL_RULE_SEQUENCE_RESET_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

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
	readonly selectedSerialRule = signal<SerialRuleDto | null>(null);

	readonly serialRules = computed(() => {
		const all = this.serialRuleApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly serialRuleTable = viewChild<Table>('serialRuleTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		serialRule: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			serialRule: this.serialRuleTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'serialRule') {
			this.selectedSerialRule.set(this._reconcile(this.selectedSerialRule(), visible as SerialRuleDto[]));
		}
	}

	selectSerialRule(serialRule: SerialRuleDto): void {
		if (this.selectedSerialRule()?.id === serialRule.id) return;
		this.selectedSerialRule.set(serialRule);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.serialRule);

		effect(() => {
			const serialRules = this.serialRules();
			untracked(() => this.selectedSerialRule.set(this._reconcile(this.selectedSerialRule(), serialRules)));
		});

	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			serialRules: this.serialRuleApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('serialRule.err.load'), err),
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
			entity: this.i18n.t('serialRule.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), ruleCode: this._nextCode() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedSerialRule();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			ruleCode: row.ruleCode,
			ruleName: row.ruleName,
			productId: row.productId,
			prefix: row.prefix,
			suffix: row.suffix ?? null,
			dateFormat: row.dateFormat,
			separator: row.separator,
			sequenceLength: row.sequenceLength,
			sequenceResetType: row.sequenceResetType,
			pattern: row.pattern,
			isActive: row.isActive ?? true,
			isDefault: row.isDefault,
			remark: row.remark ?? null,
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
					entity: this.i18n.t('serialRule.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('serialRule.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedSerialRule();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('serialRule.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.ruleName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.serialRuleApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.ruleName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('serialRule.lower') }), err),
			}),
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			ruleCode: '',
			ruleName: '',
			productId: 0,
			prefix: '',
			suffix: null as string | null,
			dateFormat: '',
			separator: '',
			sequenceLength: 2,
			sequenceResetType: 1,
			pattern: '',
			isActive: true as boolean | null,
			isDefault: false,
			remark: null as string | null,
		};
	}

	private _validate(): string {
		const ruleCode = this.form.ruleCode.trim();

		if (!ruleCode) {
			return this.i18n.t('serialRule.err.ruleCodeRequired');
		}

		if (!this.form.ruleName) {
			return this.i18n.t('serialRule.err.ruleNameRequired');
		}

		if (!this.form.productId) {
			return this.i18n.t('serialRule.err.productRequired');
		}

		if (!this.form.prefix) {
			return this.i18n.t('serialRule.err.prefixRequired');
		}

		// if (!this.form.suffix) {
		// 	return this.i18n.t('serialRule.err.suffixRequired');
		// }

		if (!this.form.dateFormat) {
			return this.i18n.t('serialRule.err.dateFormatRequired');
		}
		if (!this.form.separator) {
			return this.i18n.t('serialRule.err.separatorRequired');
		}

		if (!this.form.sequenceLength || this.form.sequenceLength <= 0) {
			return this.i18n.t('serialRule.err.sequenceLengthRequired');
		}

		if (!this.form.pattern) {
			return this.i18n.t('serialRule.err.patternRequired');
		}

		const clash = this.serialRules().find(
			rule =>
				rule.ruleCode.toLowerCase() === ruleCode.toLowerCase() &&
				rule.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('serialRule.err.ruleCodeTaken', { ruleCode })
			: '';
	}


	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveRule(id: number | null): Observable<SerialRuleDto> {
		const body: SerialRuleRequest = {
			ruleCode: this.form.ruleCode,
			ruleName: this.form.ruleName,
			productId: this.form.productId,
			prefix: this.form.prefix,
			suffix: this.form.suffix,
			dateFormat: this.form.dateFormat,
			separator: this.form.separator,
			sequenceLength: this.form.sequenceLength ?? 2,
			sequenceResetType: this.form.sequenceResetType,
			pattern: this.form.pattern,
			isActive: this.form.isActive ?? true,
			isDefault: this.form.isDefault,
			remark: this.form.remark ?? null,
		};
		return id ? this.serialRuleApi.update(id, body) : this.serialRuleApi.create(body);
	}

	private _nextCode(): string {
		let code = "";

		const prefixCode = "SR_";
		const maxCode = Math.max(
			0,
			...this.serialRuleApi.items()
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
