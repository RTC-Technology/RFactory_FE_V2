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
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { I18nService } from '../../core/services/i18n.service';
import { UnitApiService, ProductApiService, RoutingApiService } from '../../core/services/product-api.service';
import { InspectionItemApiService, InspectionPlanApiService, QualitySpecificationApiService, QualitySpecificationItemApiService, QualitySpecificationProductApiService, SamplingPlanApiService } from '../../core/services/quality-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { INSPECTION_EXECUTION_TYPE, INSPECTION_PLAN_STATUSES, INSPECTION_PLAN_TYPES, InspectionItemDto, InspectionPlanDto, InspectionPlanRequest, QUALITY_INSPECTION_TYPES, QUALITY_STATUSES, QualitySpecificationDto, QualitySpecificationItemDto, QualitySpecificationProductDto, QualitySpecificationRequest } from '../../domain/models/quality.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { productStatusOf } from '../../domain/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { UserApiService } from '../../core/services/organization-api.service';
import { InspectionExecutionComponent } from '../inspection-execution/inspection-execution.component';

type EntityKind = 'inspectionPlan' | 'inspectionItem' | 'inspectionExecution' | 'inspectionResult';
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
		InspectionExecutionComponent
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './inspection-plan.component.html',
	styleUrl: './inspection-plan.component.scss',
})
export class InspectionPlanComponent extends PermissionAwarePage implements OnInit {
	private readonly inspectionPlanApi = inject(InspectionPlanApiService);
	private readonly inspectionItemApi = inject(InspectionItemApiService);

	private readonly specApi = inject(QualitySpecificationApiService);
	private readonly specItemApi = inject(QualitySpecificationItemApiService);
	private readonly specProductApi = inject(QualitySpecificationProductApiService);
	private readonly samplingPlanApi = inject(SamplingPlanApiService);

	private readonly productApi = inject(ProductApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly routingApi = inject(RoutingApiService);
	private readonly authService = inject(AuthService);
	private readonly userApi = inject(UserApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	typeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = INSPECTION_PLAN_TYPES.find(u => u.value === id);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = INSPECTION_PLAN_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	routingLabel(id?: number | null): string {
		if (id == null) return '';
		const routing = this.routingApi.items().find(u => u.id === id);
		return routing ? `${routing.version}` : '';
	}

	specLabel(id?: number | null): string {
		if (id == null) return '';
		const spec = this.specApi.items().find(u => u.id === id);
		return spec ? `${spec.specificationCode} · ${spec.specificationName}` : '';
	}

	specItemLabel(id?: number | null): string {
		if (id == null) return '';
		const specItem = this.specItemApi.items().find(u => u.id === id);
		return specItem ? `${specItem.parameterCode} · ${specItem.parameterName}` : '';
	}

	samplingPlanLabel(id?: number | null): string {
		if (id == null) return '';
		const samplingPlan = this.samplingPlanApi.items().find(u => u.id === id);
		return samplingPlan ? `${samplingPlan.samplingPlanCode} · ${samplingPlan.samplingPlanName}` : '';
	}

	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	readonly typeOptions = computed(() =>
		INSPECTION_PLAN_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		INSPECTION_PLAN_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

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

	routingOptions() {
		return this.routingApi.items()
			.filter(x => x.productId === this.form.productId)
			.map(r => ({ label: `${r.version}`, value: r.id }));
	}

	specOptions() {
		const specProduct = this.specProductApi.items()
			.filter(x => x.productId === this.form.productId)
			.map(x => x.qualitySpecificationId);

		return this.specApi.items()
			.filter(x => specProduct.includes(x.id))
			.map(r => ({ label: `${r.specificationCode} · ${r.specificationName}`, value: r.id }));
	}

	readonly samplingPlanOptions = computed(() =>
		this.samplingPlanApi.items()
			.map(r => ({ label: `${r.samplingPlanCode} · ${r.samplingPlanName}`, value: r.id })));

	specItemOptions() {
		return this.specItemApi.items()
			.filter(x => x.qualitySpecificationId === this.form.qualitySpecificationId)
			.map(r => ({ label: `${r.parameterCode} · ${r.parameterName}`, value: r.id }));
	}

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedPlan = signal<InspectionPlanDto | null>(null);
	readonly selectedItem = signal<InspectionItemDto | null>(null);

	readonly inspectionPlans = computed(() => {
		const all = this.inspectionPlanApi.items();
		return all;
	});

	readonly inspectionItems = computed(() => {
		const id = this.selectedPlan()?.id;
		if (id == null) return [];
		return this.inspectionItemApi.items().filter(e => e.inspectionPlanId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly planTable = viewChild<Table>('planTable');
	private readonly itemTable = viewChild<Table>('itemTable');
	private readonly executionTable = viewChild<Table>('executionTable');
	private readonly resultTable = viewChild<Table>('resultTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		inspectionPlan: ['planCode', 'planName', 'version', 'remark'],
		inspectionItem: ['inspectionMethod', 'frequency', 'remark'],
		inspectionExecution: ['executionNo'],
		inspectionResult: ['actualValue'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			inspectionPlan: this.planTable(),
			inspectionItem: this.itemTable(),
			inspectionExecution: this.executionTable(),
			inspectionResult: this.resultTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'inspectionPlan') {
			this.selectedPlan.set(this._reconcile(this.selectedPlan(), visible as InspectionPlanDto[]));
		} else if (kind === 'inspectionItem') {
			this.selectedItem.set(this._reconcile(this.selectedItem(), visible as InspectionItemDto[]));
		}
	}

	selectPlan(plan: InspectionPlanDto): void {
		if (this.selectedPlan()?.id === plan.id) return;
		this.selectedPlan.set(plan);
	}

	selectItem(item: InspectionItemDto): void {
		if (this.selectedItem()?.id === item.id) return;
		this.selectedItem.set(item);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.inspectionPlan);

		effect(() => {
			const plans = this.inspectionPlans();
			untracked(() => this.selectedPlan.set(this._reconcile(this.selectedPlan(), plans)));
		});

		effect(() => {
			const items = this.inspectionItems();
			untracked(() => this.selectedItem.set(this._reconcile(this.selectedItem(), items)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			inspectionPlans: this.inspectionPlanApi.load(),
			inspectionItems: this.inspectionItemApi.load(),

			products: this.productApi.load(),
			routings: this.routingApi.load(),
			specs: this.specApi.load(),
			specItems: this.specItemApi.load(),
			specProducts: this.specProductApi.load(),
			users: this.userApi.load(),
			units: this.unitApi.load(),
			samplingPlans: this.samplingPlanApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('inspectionPlan.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly itemRows = signal<InspectionItemDto[]>([]);

	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('inspectionPlan.lower'),
		}));

	readonly dialogResultTitle = computed(() =>
		this.i18n.t('inspectionExecution.title') + ' : ' + this.selectedPlan()?.planCode);


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm() };
		this.itemRows.set([this._emptyItemRow()]);

		this.dialogOpen.set(true);
	}

	openResult(): void {
		this.resultOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedPlan();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			planCode: row.planCode,
			planName: row.planName,
			productId: row.productId,
			routingId: row.routingId,
			qualitySpecificationId: row.qualitySpecificationId,
			inspectionType: row.inspectionType,
			version: row.version,
			status: row.status,
			effectiveFrom: this._toLocalInput(row.effectiveFrom),
			effectiveTo: this._toLocalInput(row.effectiveTo),
			approvedBy: row.approvedBy ?? null,
			approvedAt: this._toLocalInput(row.approvedAt),
			remark: row.remark ?? null,
			samplingPlanId: row.samplingPlanId ?? null,
		};

		this.itemRows.set(
			this.inspectionItemApi.items()
				.filter(d => d.inspectionPlanId === row.id)
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
					entity: this.i18n.t('inspectionPlan.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('inspectionPlan.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedPlan();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('inspectionPlan.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.planCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.inspectionPlanApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.planCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('inspectionPlan.lower') }), err),
			}),
		});
	}

	askApprove(isApprove: boolean): void {
		const row = this.selectedPlan();
		if (!row) return;

		const headerKey = isApprove ? 'plant.confirm.approve.title' : 'plant.confirm.unapprove.title';
		const messageKey = isApprove ? 'plant.confirm.approve.message' : 'plant.confirm.unapprove.message';
		const acceptLabelKey = isApprove ? 'common.approve' : 'common.unapprove';

		this.confirm.confirm({
			header: this.i18n.t(headerKey, { entity: this.i18n.t('inspectionPlan.lower') }),
			message: `${this.i18n.t(messageKey, { label: row.planCode })}`,
			acceptLabel: this.i18n.t(acceptLabelKey),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: isApprove ? 'p-button-success' : 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this._approveInspectionPlan(row.id, isApprove).subscribe({
				next: () => {
					this.saving.set(false);
					this.dialogOpen.set(false);
					this.reload();
					this._ok(this.i18n.t(isApprove ? 'plant.ok.approved' : 'plant.ok.unapproved', {
						label: row.planCode
					}));
				},
				error: (err: HttpErrorResponse) => {
					this.saving.set(false);
					this.formError.set(err.error?.message
						|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('inspectionPlan.lower') }));
				},
			}),
		});
	}

	// ─── item grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
	}

	removeItemRow(row: InspectionItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			planCode: this._nextPlanCode(),
			planName: '',
			productId: 0,
			routingId: 0,
			qualitySpecificationId: 0,
			inspectionType: 1,
			version: this._nextPlanVersion(),
			status: 1,
			effectiveFrom: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			effectiveTo: null as string | null,
			approvedBy: null as number | null,
			approvedAt: null as string | null,
			remark: null as string | null,
			samplingPlanId: null as number | null,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			inspectionPlanId: null as number | null,
			qualitySpecificationItemId: 0,
			sequenceNo: 0,
			inspectionMethod: '',
			sampleSize: 0,
			frequency: '',
			isRequired: true,
			remark: null as string | null,
		};
	}


	private _validate(): string {
		const planCode = this.form.planCode.trim();

		if (!planCode) {
			return this.i18n.t('inspectionPlan.err.planCodeRequired');
		}

		if (!this.form.planName) {
			return this.i18n.t('inspectionPlan.err.planNameRequired');
		}

		if (!this.form.version) {
			return this.i18n.t('inspectionPlan.err.versionRequired');
		}

		const clash = this.inspectionPlans().find(
			plan =>
				plan.planCode.toLowerCase() === planCode.toLowerCase() &&
				plan.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('inspectionPlan.err.planCodeTaken', { planCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _savePlan(id: number | null): Observable<InspectionPlanDto> {
		const body: InspectionPlanRequest = {
			planCode: this.form.planCode,
			planName: this.form.planName,
			productId: this.form.productId,
			routingId: this.form.routingId,
			qualitySpecificationId: this.form.qualitySpecificationId,
			inspectionType: this.form.inspectionType,
			version: this.form.version,
			status: this.form.status,
			effectiveFrom: this.form.effectiveFrom ?? null,
			effectiveTo: this.form.effectiveTo ?? null,
			approvedBy: this.form.approvedBy ?? null,
			approvedAt: this.form.approvedAt ?? null,
			remark: this.form.remark ?? null,
			samplingPlanId: this.form.samplingPlanId ?? null,
			inspectionItems: this.itemRows().map((r, index) => ({
				id: r.id > 0 ? r.id : 0,
				inspectionPlanId: r.inspectionPlanId ?? null,
				qualitySpecificationItemId: r.qualitySpecificationItemId,
				sequenceNo: index + 1,
				inspectionMethod: r.inspectionMethod,
				sampleSize: r.sampleSize ?? null,
				frequency: r.frequency,
				isRequired: r.isRequired,
				remark: r.remark ?? null,
			}))
		};
		return id ? this.inspectionPlanApi.update(id, body) : this.inspectionPlanApi.create(body);
	}

	private _approveInspectionPlan(id: number | null, isApprove: boolean): Observable<InspectionPlanDto> {
		if (id == null) {
			return throwError(() => new Error(this.i18n.t('inspectionPlan.err.notFound')));
		}

		const plan = this.inspectionPlanApi.items().find(r => r.id === id);
		if (!plan) {
			return throwError(() => new Error(this.i18n.t('inspectionPlan.err.notFound')));
		}

		const body: InspectionPlanRequest = {
			planCode: plan.planCode,
			planName: plan.planName,
			productId: plan.productId,
			routingId: plan.routingId,
			qualitySpecificationId: plan.qualitySpecificationId,
			inspectionType: plan.inspectionType,
			version: plan.version,
			status: isApprove ? 3 : 2,
			effectiveFrom: plan.effectiveFrom ?? null,
			effectiveTo: plan.effectiveTo ?? null,
			remark: plan.remark ?? null,

			approvedBy: parseInt(this.authService.currentUser()?.id || '0'),
			approvedAt: isApprove ? formatDate(new Date(), 'yyyy-MM-ddTHH:mm:ss', 'en-US') : plan.approvedAt,
		};

		return this.inspectionPlanApi.update(id, body);
	}

	private _nextPlanCode(): string {
		let code = "";

		const prefixCode = "PL_";
		const maxCode = Math.max(
			0,
			...this.inspectionPlanApi.items()
				.filter(x => x.planCode.startsWith(prefixCode))
				.map(x => parseInt(x.planCode.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}
	private _nextPlanVersion(): string {
		let code = "";

		const prefixCode = "V";
		const maxCode = Math.max(
			0,
			...this.inspectionPlanApi.items()
				.filter(x => x.version.startsWith(prefixCode))
				.map(x => parseInt(x.version.replace(prefixCode, '')))
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
