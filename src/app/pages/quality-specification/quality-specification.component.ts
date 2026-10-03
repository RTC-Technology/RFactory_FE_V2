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
import { UnitApiService, ProductApiService } from '../../core/services/product-api.service';
import { QualitySpecificationApiService, QualitySpecificationItemApiService, QualitySpecificationProductApiService } from '../../core/services/quality-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { QUALITY_INSPECTION_TYPES, QUALITY_STATUSES, QualitySpecificationDto, QualitySpecificationItemDto, QualitySpecificationProductDto, QualitySpecificationRequest } from '../../domain/models/quality.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { productStatusOf } from '../../domain/models/product.model';

type EntityKind = 'qualitySpec' | 'qualitySpecItem' | 'qualitySpecProduct';
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
	selector: 'app-quality-specification',
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
	templateUrl: './quality-specification.component.html',
	styleUrl: './quality-specification.component.scss',
})
export class QualitySpecificationComponent extends PermissionAwarePage implements OnInit {
	private readonly specApi = inject(QualitySpecificationApiService);
	private readonly specItemApi = inject(QualitySpecificationItemApiService);
	private readonly specProductApi = inject(QualitySpecificationProductApiService);

	private readonly unitApi = inject(UnitApiService);
	private readonly productApi = inject(ProductApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	typeLabel(id?: number | null): string {
		if (id == null) return '';
		const type = QUALITY_INSPECTION_TYPES.find(u => u.value === id);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	statusLabel(id?: number | null): string {
		if (id == null) return '';
		const status = QUALITY_STATUSES.find(u => u.value === id);
		return status ? this.i18n.t(status.labelKey) : '';
	}

	productLabel(id?: number | null): string {
		if (id == null) return '';
		const product = this.productApi.items().find(u => u.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	unitLabel(id?: number | null): string {
		if (id == null) return '';
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? `${unit.unitCode} · ${unit.unitName}` : '';
	}

	readonly typeOptions = computed(() =>
		QUALITY_INSPECTION_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly statusOptions = computed(() =>
		QUALITY_STATUSES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

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

	readonly unitOptions = computed(() =>
		this.unitApi.items().map(u => ({ label: `${u.unitCode} · ${u.unitName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedSpec = signal<QualitySpecificationDto | null>(null);
	readonly selectedSpecItem = signal<QualitySpecificationItemDto | null>(null);
	readonly selectedSpecProduct = signal<QualitySpecificationProductDto | null>(null);

	readonly specs = computed(() => {
		const all = this.specApi.items();
		return all;
	});

	readonly specItems = computed(() => {
		const id = this.selectedSpec()?.id;
		if (id == null) return [];
		return this.specItemApi.items().filter(e => e.qualitySpecificationId === id);
	});

	readonly specProducts = computed(() => {
		const id = this.selectedSpec()?.id;
		if (id == null) return [];
		return this.specProductApi.items().filter(e => e.qualitySpecificationId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly specTable = viewChild<Table>('specTable');
	private readonly specItemTable = viewChild<Table>('specItemTable');
	private readonly specProductTable = viewChild<Table>('specProductTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		qualitySpec: ['specificationCode', 'specificationName', 'version', 'remark'],
		qualitySpecItem: ['parameterCode', 'parameterName', 'targetValue', 'remark'],
		qualitySpecProduct: [],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			qualitySpec: this.specTable(),
			qualitySpecItem: this.specItemTable(),
			qualitySpecProduct: this.specProductTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'qualitySpec') {
			this.selectedSpec.set(this._reconcile(this.selectedSpec(), visible as QualitySpecificationDto[]));
		} else if (kind === 'qualitySpecItem') {
			this.selectedSpecItem.set(this._reconcile(this.selectedSpecItem(), visible as QualitySpecificationItemDto[]));
		} else if (kind === 'qualitySpecProduct') {
			this.selectedSpecProduct.set(this._reconcile(this.selectedSpecProduct(), visible as QualitySpecificationProductDto[]));
		}
	}

	selectSpec(spec: QualitySpecificationDto): void {
		if (this.selectedSpec()?.id === spec.id) return;
		this.selectedSpec.set(spec);
	}

	selectSpecItem(specItem: QualitySpecificationItemDto): void {
		if (this.selectedSpecItem()?.id === specItem.id) return;
		this.selectedSpecItem.set(specItem);
	}

	selectSpecProduct(specProduct: QualitySpecificationProductDto): void {
		if (this.selectedSpecProduct()?.id === specProduct.id) return;
		this.selectedSpecProduct.set(specProduct);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.qualitySpecification);

		effect(() => {
			const specs = this.specs();
			untracked(() => this.selectedSpec.set(this._reconcile(this.selectedSpec(), specs)));
		});

		effect(() => {
			const specItems = this.specItems();
			untracked(() => this.selectedSpecItem.set(this._reconcile(this.selectedSpecItem(), specItems)));
		});

		effect(() => {
			const specProducts = this.specProducts();
			untracked(() => this.selectedSpecProduct.set(this._reconcile(this.selectedSpecProduct(), specProducts)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			qualitySpecifications: this.specApi.load(),
			qualitySpecificationItems: this.specItemApi.load(),
			qualitySpecificationProducts: this.specProductApi.load(),

			products: this.productApi.load(),
			units: this.unitApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('qualitySpecification.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly itemRows = signal<QualitySpecificationItemDto[]>([]);
	readonly productRows = signal<QualitySpecificationProductDto[]>([]);

	private _tempItemId = 0;
	private _tempProductId = 0;

	activeTab = 'item';

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('qualitySpecification.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm() };
		this.itemRows.set([this._emptyItemRow()]);
		this.productRows.set([this._emptyProductRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedSpec();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			specificationCode: row.specificationCode,
			specificationName: row.specificationName,
			version: row.version,
			inspectionType: row.inspectionType,
			status: row.status,
			effectiveFrom: this._toLocalInput(row.effectiveFrom),
			effectiveTo: this._toLocalInput(row.effectiveTo),
			remark: row.remark ?? null,
		};

		this.itemRows.set(
			this.specItemApi.items()
				.filter(d => d.qualitySpecificationId === row.id)
				.map(d => ({ ...d })));

		this.productRows.set(
			this.specProductApi.items()
				.filter(d => d.qualitySpecificationId === row.id)
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
		this._saveSpec(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('qualitySpecification.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('qualitySpecification.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedSpec();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('qualitySpecification.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.specificationCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.specApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.specificationCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('qualitySpecification.lower') }), err),
			}),
		});
	}

	// onDepartmentChange(departmentId: number | null): void {
	// 	if (this.form.sortOrder !== 0) return;
	// 	this.form.sortOrder = this._nextSortOrder(departmentId ?? 0);
	// }

	// ─── item grid ────────────────────────────────────────────────────────────
	addItemRow(): void {
		this.itemRows.update(rows => [...rows, this._emptyItemRow()]);
		console.log('itemRows:', this.itemRows());
	}

	removeItemRow(row: QualitySpecificationItemDto): void {
		this.itemRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── product grid ────────────────────────────────────────────────────────────
	addProductRow(): void {
		this.productRows.update(rows => [...rows, this._emptyProductRow()]);
	}

	removeProductRow(row: QualitySpecificationProductDto): void {
		this.productRows.update(rows => rows.filter(r => r !== row));
	}


	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			specificationCode: this._nextSpecCode(),
			specificationName: '',
			version: this._nextSpecVersion(),
			inspectionType: 1,
			status: 1,
			effectiveFrom: formatDate(new Date(), DATETIME_LOCAL, 'en-US') as string | null,
			effectiveTo: null as string | null,
			remark: null as string | null,
		};
	}

	private _emptyItemRow() {
		return {
			id: this._tempItemId--,
			qualitySpecificationId: null as number | null,
			sequenceNo: this._nextSequenceNo(),
			parameterCode: this._nextParamCode(),
			parameterName: '',
			unitId: null as number | null,
			targetValue: null as string | null,
			minValue: null as number | null,
			maxValue: null as number | null,
			isRequired: true,
			remark: null as string | null,
		};
	}

	private _emptyProductRow() {
		return {
			id: this._tempProductId--,
			qualitySpecificationId: null as number | null,
			productId: null as number | null,
		};
	}


	private _validate(): string {
		const specificationCode = this.form.specificationCode.trim();

		if (!specificationCode) {
			return this.i18n.t('qualitySpecification.err.specificationCodeRequired');
		}

		if (!this.form.specificationName) {
			return this.i18n.t('qualitySpecification.err.specificationNameRequired');
		}

		if (!this.form.version) {
			return this.i18n.t('qualitySpecification.err.versionRequired');
		}

		// IssueNo is unique across the entire goods issue list.
		const clash = this.specs().find(
			spec =>
				spec.specificationCode.toLowerCase() === specificationCode.toLowerCase() &&
				spec.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('qualitySpecification.err.specificationCodeTaken', { specificationCode })
			: '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveSpec(id: number | null): Observable<QualitySpecificationDto> {
		const body: QualitySpecificationRequest = {
			specificationCode: this.form.specificationCode,
			specificationName: this.form.specificationName,
			version: this.form.version,
			inspectionType: this.form.inspectionType,
			status: this.form.status,
			effectiveFrom: this.form.effectiveFrom ?? null,
			effectiveTo: this.form.effectiveTo ?? null,
			remark: this.form.remark ?? null,
			qualitySpecificationItems: this.itemRows().map(r => ({
				id: r.id > 0 ? r.id : 0,
				qualitySpecificationId: r.qualitySpecificationId ?? null,
				sequenceNo: r.sequenceNo,
				parameterCode: r.parameterCode,
				parameterName: r.parameterName,
				unitId: r.unitId ?? null,
				targetValue: r.targetValue ?? null,
				minValue: r.minValue ?? null,
				maxValue: r.maxValue ?? null,
				isRequired: r.isRequired ?? false,
				remark: r.remark ?? null,
			})),

			qualitySpecificationProducts: this.productRows().map(r => ({
				id: r.id > 0 ? r.id : 0,
				qualitySpecificationId: r.qualitySpecificationId ?? null,
				productId: r.productId ?? null,
			})),
		};

		// console.log('productRows:', this.productRows());
		// console.log('productOptions:', this.productOptions());
		return id ? this.specApi.update(id, body) : this.specApi.create(body);
	}


	private _nextSpecCode(): string {
		let code = "";

		const prefixCode = "SP_";
		const maxCode = Math.max(
			0,
			...this.specApi.items()
				.filter(x => x.specificationCode.startsWith(prefixCode))
				.map(x => parseInt(x.specificationCode.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}

	private _nextSpecVersion(): string {
		let code = "";

		const prefixCode = "V";
		const maxCode = Math.max(
			0,
			...this.specApi.items()
				.filter(x => x.version.startsWith(prefixCode))
				.map(x => parseInt(x.version.replace(prefixCode, '')))
		);

		code = prefixCode + (maxCode + 1).toString().padStart(2, '0');
		return code;
	}


	private _nextSequenceNo(): number {
		const maxSequenceNo = Math.max(
			0,
			...this.itemRows()
				.map(x => x.sequenceNo)
		);
		return maxSequenceNo + 1;
	}

	private _nextParamCode(): string {
		let code = "";

		const prefixCode = "PM_";
		const maxCode = Math.max(
			0,
			...this.itemRows()
				.filter(x => x.parameterCode.startsWith(prefixCode))
				.map(x => parseInt(x.parameterCode.replace(prefixCode, '')))
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
