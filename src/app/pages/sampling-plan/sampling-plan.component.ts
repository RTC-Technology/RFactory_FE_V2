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
import { InspectionExecutionComponent } from '../inspection-execution/inspection-execution.component';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { SamplingPlanApiService, SamplingPlanRuleApiService } from '../../core/services/quality-api.service';
import { SAMPLING_PLAN_FREQUENCY_TYPES, SAMPLING_PLAN_LEVELS, SAMPLING_PLAN_METHODS, SAMPLING_PLAN_STATUSES, SamplingPlanDto, SamplingPlanRequest, SamplingPlanRuleDto } from '../../domain/models/quality.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'samplingPlan' | 'samplingPlanRule';
const DATETIME_LOCAL = "yyyy-MM-dd";

@Component({
	selector: 'app-sampling-plan',
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
	templateUrl: './sampling-plan.component.html',
	styleUrl: './sampling-plan.component.scss',
})
export class SamplingPlanComponent extends PermissionAwarePage implements OnInit {
	private readonly samplingPlanApi = inject(SamplingPlanApiService);
	private readonly samplingPlanRuleApi = inject(SamplingPlanRuleApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	methodLabel(value?: number | null): string {
		if (value == null) return '';
		const type = SAMPLING_PLAN_METHODS.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}
	levelLabel(value?: string | null): string {
		if (value == null) return '';
		const type = SAMPLING_PLAN_LEVELS.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	frequencyTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = SAMPLING_PLAN_FREQUENCY_TYPES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(value?: number | null): string {
		if (value == null) return '';
		const status = SAMPLING_PLAN_STATUSES.find(u => u.value === value);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	readonly methodOptions = computed(() =>
		SAMPLING_PLAN_METHODS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly levelOptions = computed(() =>
		SAMPLING_PLAN_LEVELS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly frequencyTypeOptions = computed(() =>
		SAMPLING_PLAN_FREQUENCY_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		SAMPLING_PLAN_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedPlan = signal<SamplingPlanDto | null>(null);
	readonly selectedRule = signal<SamplingPlanRuleDto | null>(null);

	readonly plans = computed(() => {
		const all = this.samplingPlanApi.items();
		return all;
	});

	readonly rules = computed(() => {
		const id = this.selectedPlan()?.id;
		if (id == null) return [];
		return this.samplingPlanRuleApi.items().filter(e => e.samplingPlanId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly planTable = viewChild<Table>('planTable');
	private readonly ruleTable = viewChild<Table>('ruleTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		samplingPlan: ['samplingPlanCode', 'samplingPlanName', 'description', 'remark'],
		samplingPlanRule: ['sortOrder', 'lotSizeFrom', 'lotSizeTo', 'sampleSize', 'acceptanceNumber', 'rejectionNumber'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			samplingPlan: this.planTable(),
			samplingPlanRule: this.ruleTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'samplingPlan') {
			this.selectedPlan.set(this._reconcile(this.selectedPlan(), visible as SamplingPlanDto[]));
		} else if (kind === 'samplingPlanRule') {
			this.selectedRule.set(this._reconcile(this.selectedRule(), visible as SamplingPlanRuleDto[]));
		}
	}

	selectPlan(plan: SamplingPlanDto): void {
		if (this.selectedPlan()?.id === plan.id) return;
		this.selectedPlan.set(plan);
	}

	selectRule(rule: SamplingPlanRuleDto): void {
		if (this.selectedRule()?.id === rule.id) return;
		this.selectedRule.set(rule);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.samplingPlan);

		effect(() => {
			const plans = this.plans();
			untracked(() => this.selectedPlan.set(this._reconcile(this.selectedPlan(), plans)));
		});

		effect(() => {
			const rules = this.rules();
			untracked(() => this.selectedRule.set(this._reconcile(this.selectedRule(), rules)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			samplingPlans: this.samplingPlanApi.load(),
			samplingPlanRules: this.samplingPlanRuleApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('samplingPlan.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly ruleRows = signal<SamplingPlanRuleDto[]>([]);

	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('samplingPlan.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm(), samplingPlanCode: this._nextPlanCode() };
		this.ruleRows.set([this._emptyRuleRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPlan();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			samplingPlanCode: row.samplingPlanCode,
			samplingPlanName: row.samplingPlanName,
			description: row.description ?? null,
			samplingMethod: row.samplingMethod ?? null,
			inspectionLevel: row.inspectionLevel ?? null,
			aqlValue: row.aqlValue ?? null,
			frequencyType: row.frequencyType ?? null,
			frequencyValue: row.frequencyValue ?? null,
			status: row.status,
			effectiveFrom: this._toLocalInput(row.effectiveFrom),
			effectiveTo: this._toLocalInput(row.effectiveTo),
			remark: row.remark ?? null,
		};

		this.ruleRows.set(
			this.samplingPlanRuleApi.items()
				.filter(d => d.samplingPlanId === row.id)
				.map(d => ({ ...d })));

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
		this._savePlan(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('samplingPlan.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('samplingPlan.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedPlan();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('samplingPlan.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.samplingPlanCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.samplingPlanApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.samplingPlanCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('samplingPlan.lower') }), err),
			}),
		});
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addRuleRow(): void {
		this.ruleRows.update(rows => [...rows, this._emptyRuleRow()]);
	}

	removeRuleRow(row: SamplingPlanRuleDto): void {
		this.ruleRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			samplingPlanCode: '',
			samplingPlanName: '',
			description: null as string | null,
			samplingMethod: null as number | null,
			inspectionLevel: null as string | null,
			aqlValue: null as number | null,
			frequencyType: null as number | null,
			frequencyValue: null as number | null,
			status: 1,
			effectiveFrom: null as string | null,
			effectiveTo: null as string | null,
			remark: null as string | null,
		};
	}

	private _emptyRuleRow() {
		return {
			id: this._tempItemId--,
			samplingPlanId: null as number | null,
			lotSizeFrom: 0 as number | null,
			lotSizeTo: 0 as number | null,
			sampleSize: 0 as number | null,
			acceptanceNumber: 0 as number | null,
			rejectionNumber: 0 as number | null,
			sortOrder: 0,
		};
	}


	private _validate(): string {
		const planCode = this.form.samplingPlanCode.trim();

		if (!planCode) {
			return this.i18n.t('samplingPlan.err.samplingPlanCodeRequired');
		}

		if (!this.form.samplingPlanName) {
			return this.i18n.t('samplingPlan.err.samplingPlanNameRequired');
		}

		if (!this.form.status) {
			return this.i18n.t('samplingPlan.err.statusRequired');
		}

		const clash = this.plans().find(
			plan =>
				plan.samplingPlanCode.toLowerCase() === planCode.toLowerCase() &&
				plan.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('samplingPlan.err.samplingPlanCodeTaken', { planCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _savePlan(id: number | null): Observable<SamplingPlanDto> {
		const body: SamplingPlanRequest = {
			samplingPlanCode: this.form.samplingPlanCode,
			samplingPlanName: this.form.samplingPlanName,
			description: this.form.description ?? null,
			samplingMethod: this.form.samplingMethod ?? null,
			inspectionLevel: this.form.inspectionLevel ?? null,
			aqlValue: this.form.aqlValue ?? null,
			frequencyType: this.form.frequencyType ?? null,
			frequencyValue: this.form.frequencyValue ?? null,
			status: this.form.status,
			effectiveFrom: this.form.effectiveFrom ?? null,
			effectiveTo: this.form.effectiveTo ?? null,
			remark: this.form.remark ?? null,
			samplingPlanRules: this.ruleRows().map((r, index) => ({
				id: r.id > 0 ? r.id : 0,
				samplingPlanId: r.samplingPlanId ?? null,
				lotSizeFrom: r.lotSizeFrom ?? null,
				lotSizeTo: r.lotSizeTo ?? null,
				sampleSize: r.sampleSize ?? null,
				acceptanceNumber: r.acceptanceNumber ?? null,
				rejectionNumber: r.rejectionNumber ?? null,
				sortOrder: index + 1,
			}))
		};
		return id ? this.samplingPlanApi.update(id, body) : this.samplingPlanApi.create(body);
	}

	private _nextPlanCode(): string {
		let code = "";

		const prefixCode = "SP_";
		const maxCode = Math.max(
			0,
			...this.samplingPlanApi.items()
				.filter(x => x.samplingPlanCode.startsWith(prefixCode))
				.map(x => parseInt(x.samplingPlanCode.replace(prefixCode, '')))
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
