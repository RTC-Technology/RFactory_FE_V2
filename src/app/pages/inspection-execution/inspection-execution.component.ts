import { Component, computed, effect, inject, input, OnInit, signal, untracked, viewChild } from '@angular/core';
import { INSPECTION_EXECUTION_STATUSES, INSPECTION_EXECUTION_TYPE, INSPECTION_RESULTS, InspectionExecutionDto, InspectionExecutionRequest, InspectionPlanDto, InspectionResultDto, inspectionResultOf } from '../../domain/models/quality.model';
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
import { DefectApiService, InspectionExecutionApiService, InspectionItemApiService, InspectionPlanApiService, InspectionResultApiService } from '../../core/services/quality-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { AuthService } from '../../core/services/auth.service';
import { UserApiService } from '../../core/services/organization-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { productStatusOf } from '../../domain/models/product.model';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

type EntityKind = 'inspectionExecution' | 'inspectionResult';
const DATETIME_LOCAL = "yyyy-MM-ddTHH:mm";

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
	selector: 'app-inspection-execution',
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
		ToggleButtonModule
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './inspection-execution.component.html',
	styleUrl: './inspection-execution.component.scss',
})
export class InspectionExecutionComponent extends PermissionAwarePage implements OnInit {
	readonly inspectionPlanDto = input<InspectionPlanDto | null>(null);

	private readonly inspectionPlanApi = inject(InspectionPlanApiService);
	private readonly inspectionItemApi = inject(InspectionItemApiService);
	private readonly inspectionExecutionApi = inject(InspectionExecutionApiService);
	private readonly inspectionResultApi = inject(InspectionResultApiService);

	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly authService = inject(AuthService);
	private readonly userApi = inject(UserApiService);
	private readonly defectApi = inject(DefectApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);
	readonly currentUser = computed(() => this.authService.currentUser());
	readonly resultOf = inspectionResultOf;

	// ─── Lookups ────────────────────────────────────────────────────────────────

	typeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = INSPECTION_EXECUTION_TYPE.find(u => u.value === id);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = INSPECTION_EXECUTION_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	resultLabel(id?: number | null): string {
		if (id == null) return '';
		const status = INSPECTION_RESULTS.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	inspectionPlanLabel(id?: number | null): string {
		if (id == null) return '';
		const inspectionPlan = this.inspectionPlanApi.items().find(u => u.id === id);
		return inspectionPlan ? `${inspectionPlan.planCode} · ${inspectionPlan.planName}` : '';
	}

	inspectionItemLabel(id?: number | null): string {
		if (id == null) return '';
		const inspectionItem = this.inspectionItemApi.items().find(u => u.id === id);
		return inspectionItem ? `${inspectionItem.sequenceNo} · ${inspectionItem.inspectionMethod}` : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}
	defectLabel(id?: number | null): string {
		if (id == null) return '';
		const defect = this.defectApi.items().find(u => u.id === id);
		return defect ? `${defect.defectCode} · ${defect.defectName}` : '';
	}

	readonly typeOptions = computed(() =>
		INSPECTION_EXECUTION_TYPE.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		INSPECTION_EXECUTION_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly resultOptions = computed(() =>
		INSPECTION_RESULTS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly planOptions = computed(() =>
		this.inspectionPlanApi.items()
			.map(r => ({ label: `${r.planCode} · ${r.planName}`, value: r.id })));

	readonly itemOptions = computed(() =>
		this.inspectionItemApi.items()
			.map(r => ({ label: `${r.sequenceNo} · ${r.inspectionMethod}`, value: r.id })));

	readonly productionOrderOptions = computed(() =>
		this.inspectionItemApi.items()
			.map(r => ({ label: `${r.sequenceNo} · ${r.inspectionMethod}`, value: r.id })));

	readonly userOptions = computed(() =>
		this.userApi.items()
			.map(r => ({ label: `${r.code} · ${r.fullName}`, value: r.id })));

	readonly defectOptions = computed(() =>
		this.defectApi.items()
			.map(r => ({ label: `${r.defectCode} · ${r.defectName}`, value: r.id })));

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
	readonly selectedExecution = signal<InspectionExecutionDto | null>(null);
	readonly selectedResult = signal<InspectionResultDto | null>(null);

	readonly executions = computed(() => {
		const all = this.inspectionExecutionApi.items();
		const planId = this.inspectionPlanDto()?.id ?? 0;
		if (planId == 0) return all;
		return all.filter(e => e.inspectionPlanId === planId);
	});

	readonly results = computed(() => {
		const id = this.selectedExecution()?.id;
		if (id == null) return [];
		return this.inspectionResultApi.items().filter(e => e.inspectionExecutionId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly executionTable = viewChild<Table>('executionTable');
	private readonly resultTable = viewChild<Table>('resultTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		inspectionExecution: ['executionNo'],
		inspectionResult: ['actualValue'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			inspectionExecution: this.executionTable(),
			inspectionResult: this.resultTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'inspectionExecution') {
			this.selectedExecution.set(this._reconcile(this.selectedExecution(), visible as InspectionExecutionDto[]));
		} else if (kind === 'inspectionResult') {
			this.selectedResult.set(this._reconcile(this.selectedResult(), visible as InspectionResultDto[]));
		}
	}

	selectExecution(execution: InspectionExecutionDto): void {
		if (this.selectedExecution()?.id === execution.id) return;
		this.selectedExecution.set(execution);
	}

	selectResult(result: InspectionResultDto): void {
		if (this.selectedResult()?.id === result.id) return;
		this.selectedResult.set(result);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.inspectionExecution);

		effect(() => {
			const executions = this.executions();
			untracked(() => this.selectedExecution.set(this._reconcile(this.selectedExecution(), executions)));
		});

		effect(() => {
			const results = this.results();
			untracked(() => this.selectedResult.set(this._reconcile(this.selectedResult(), results)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			inspectionPlans: this.inspectionPlanApi.load(),
			inspectionItems: this.inspectionItemApi.load(),
			inspectionExecutions: this.inspectionExecutionApi.load(),
			inspectionResults: this.inspectionResultApi.load(),
			products: this.productApi.load(),
			users: this.userApi.load(),
			units: this.unitApi.load(),
			defects: this.defectApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('inspectionExecution.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly resultRows = signal<InspectionResultDto[]>([]);

	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('inspectionExecution.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm() };

		const items = this.inspectionItemApi.items()
			.filter(x => x.inspectionPlanId == this.form.inspectionPlanId)
			.map(x => ({
				...this._emptyResultRow(),
				inspectionItemId: x.id,
			}));

		this.resultRows.set(items);
		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedExecution();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			executionNo: row.executionNo ?? null,
			inspectionPlanId: row.inspectionPlanId ?? 0,
			productId: row.productId ?? 0,
			lotNo: row.lotNo ?? null,
			serialNo: row.serialNo ?? null,
			productionOrderId: row.productionOrderId ?? 0,
			inspectionType: row.inspectionType,
			status: row.status,
			sampleSize: row.sampleSize ?? 0,
			startedAt: this._toLocalInput(row.startedAt),
			completedAt: this._toLocalInput(row.completedAt),
			inspectorId: row.inspectorId ?? 0,
			remark: row.remark ?? null,
		};

		this.resultRows.set(
			this.inspectionResultApi.items()
				.filter(d => d.inspectionExecutionId === row.id)
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
		this._saveExecution(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('inspectionExecution.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('inspectionExecution.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedExecution();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('inspectionExecution.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.executionNo })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.inspectionExecutionApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.executionNo })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('inspectionExecution.lower') }), err),
			}),
		});
	}

	onPlanChange(planId: number | null) {
		if (this.editingId() != null && this.resultRows().length > 0) return;
		const items = this.inspectionItemApi.items()
			.filter(x => x.inspectionPlanId == planId)
			.map(x => ({
				...this._emptyResultRow(),
				inspectionItemId: x.id,
			}));

		this.resultRows.set(items);
	}

	// ─── item grid ────────────────────────────────────────────────────────────
	addResultRow(): void {
		this.resultRows.update(rows => [...rows, this._emptyResultRow()]);
	}

	removeResultRow(row: InspectionResultDto): void {
		this.resultRows.update(rows => rows.filter(r => r !== row));
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			executionNo: this._nextExecutionNo(),
			inspectionPlanId: this.inspectionPlanDto()?.id ?? 0,
			productId: this.inspectionPlanDto()?.productId ?? 0,
			lotNo: null as string | null,
			serialNo: null as string | null,
			productionOrderId: null as number | null,
			inspectionType: 1,
			status: 1,
			sampleSize: null as number | null,
			startedAt: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			completedAt: null as string | null,
			inspectorId: parseInt(this.currentUser()?.id ?? '0') as number | null,
			remark: null as string | null,
		};
	}

	private _emptyResultRow() {
		return {
			id: this._tempItemId--,
			inspectionExecutionId: null as number | null,
			inspectionItemId: 0,
			sampleNo: null as number | null,
			actualValue: '',
			numericValue: null as number | null,
			textValue: null as string | null,
			booleanValue: null as boolean | null,
			result: 0,
			defectId: null as number | null,
			inspectionTime: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			inspectorId: parseInt(this.currentUser()?.id ?? '0') as number | null,
			remark: null as string | null,
		};
	}


	private _validate(): string {
		const executionNo = this.form.executionNo.trim();

		if (!executionNo) {
			return this.i18n.t('inspectionExecution.err.executionNoRequired');
		}

		const clash = this.inspectionExecutionApi.items().find(
			execution =>
				execution.executionNo.toLowerCase() === executionNo.toLowerCase() &&
				execution.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('inspectionExecution.err.executionNoTaken', { executionNo })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveExecution(id: number | null): Observable<InspectionExecutionDto> {
		const body: InspectionExecutionRequest = {
			executionNo: this.form.executionNo,
			inspectionPlanId: this.form.inspectionPlanId,
			productId: this.form.productId,
			lotNo: this.form.lotNo ?? null,
			serialNo: this.form.serialNo ?? null,
			productionOrderId: this.form.productionOrderId ?? null,
			inspectionType: this.form.inspectionType,
			status: this.form.status,
			sampleSize: this.form.sampleSize ?? null,
			startedAt: this.form.startedAt ?? null,
			completedAt: this.form.completedAt ?? null,
			inspectorId: this.form.inspectorId ?? null,
			remark: this.form.remark ?? null,
			inspectionResults: this.resultRows().map(r => ({
				id: r.id > 0 ? r.id : 0,
				inspectionExecutionId: r.inspectionExecutionId ?? null,
				inspectionItemId: r.inspectionItemId,
				sampleNo: r.sampleNo ?? null,
				actualValue: r.actualValue,
				numericValue: r.numericValue ?? null,
				textValue: r.textValue ?? null,
				booleanValue: r.booleanValue ?? null,
				result: r.result,
				defectId: r.defectId ?? null,
				inspectionTime: r.inspectionTime ?? null,
				inspectorId: r.inspectorId ?? null,
				remark: r.remark ?? null,
			}))
		};

		return id ? this.inspectionExecutionApi.update(id, body) : this.inspectionExecutionApi.create(body);
	}



	private _nextExecutionNo(): string {
		let code = "";

		const prefixCode = "EXEC_";
		const maxCode = Math.max(
			0,
			...this.inspectionExecutionApi.items()
				.filter(x => x.executionNo.startsWith(prefixCode))
				.map(x => parseInt(x.executionNo.replace(prefixCode, '')))
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
