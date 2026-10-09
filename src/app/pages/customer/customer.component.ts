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
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { CustomerApiService, CustomerContactApiService } from '../../core/services/master-data-api.service';
import { CUSTOMER_CONTACT_TYPES, CUSTOMER_COUNTRIES, CUSTOMER_CURRENCIES, CUSTOMER_DISTRICTS, CUSTOMER_PROVINCES, CUSTOMER_TYPES, CustomerContactDto, CustomerDto, CustomerRequest } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';

type EntityKind = 'customer' | 'customerContact';

@Component({
	selector: 'app-customer',
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
	templateUrl: './customer.component.html',
	styleUrl: './customer.component.scss',
})
export class CustomerComponent extends PermissionAwarePage implements OnInit {
	private readonly customerApi = inject(CustomerApiService);
	private readonly contactApi = inject(CustomerContactApiService);

	private readonly warehouseApi = inject(WarehouseApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	customerTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_TYPES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	contactTypeLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_CONTACT_TYPES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	countryLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_COUNTRIES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	provinceLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_PROVINCES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	districtLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_DISTRICTS.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	currencyLabel(value?: number | null): string {
		if (value == null) return '';
		const type = CUSTOMER_CURRENCIES.find(u => u.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	warehouseLabel(id?: number | null): string {
		if (id == null) return '';
		const warehouse = this.warehouseApi.items().find(u => u.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	readonly customerTypeOptions = computed(() =>
		CUSTOMER_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly contactTypeOptions = computed(() =>
		CUSTOMER_CONTACT_TYPES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly warehouseOptions = computed(() =>
		this.warehouseApi.items().map(w => ({ label: `${w.warehouseCode} · ${w.warehouseName}`, value: w.id })));

	readonly countryOptions = computed(() =>
		CUSTOMER_COUNTRIES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly provinceOptions = computed(() =>
		CUSTOMER_PROVINCES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly districtOptions = computed(() =>
		CUSTOMER_DISTRICTS.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	readonly currencyOptions = computed(() =>
		CUSTOMER_CURRENCIES.map(u => ({ label: `${this.i18n.t(u.labelKey)}`, value: u.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCustomer = signal<CustomerDto | null>(null);
	readonly selectedContact = signal<CustomerContactDto | null>(null);

	readonly customers = computed(() => {
		const all = this.customerApi.items();
		return all;
	});

	readonly contacts = computed(() => {
		const id = this.selectedCustomer()?.id;
		if (id == null) return [];
		return this.contactApi.items().filter(e => e.customerId === id);
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly customerTable = viewChild<Table>('customerTable');
	private readonly contactTable = viewChild<Table>('contactTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		customer: ['customerCode', 'customerName', 'shortName', 'englishName', 'taxCode', 'contactPerson', 'phone', 'email', 'address', 'paymentTerm', 'remark'],
		customerContact: ['contactName', 'position', 'phone', 'email', 'remark'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			customer: this.customerTable(),
			customerContact: this.contactTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'customer') {
			this.selectedCustomer.set(this._reconcile(this.selectedCustomer(), visible as CustomerDto[]));
		} else if (kind === 'customerContact') {
			this.selectedContact.set(this._reconcile(this.selectedContact(), visible as CustomerContactDto[]));
		}
	}

	selectCustomer(customer: CustomerDto): void {
		if (this.selectedCustomer()?.id === customer.id) return;
		this.selectedCustomer.set(customer);
	}

	selectContact(contact: CustomerContactDto): void {
		if (this.selectedContact()?.id === contact.id) return;
		this.selectedContact.set(contact);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.customer);

		effect(() => {
			const customers = this.customers();
			untracked(() => this.selectedCustomer.set(this._reconcile(this.selectedCustomer(), customers)));
		});

		effect(() => {
			const contacts = this.contacts();
			untracked(() => this.selectedContact.set(this._reconcile(this.selectedContact(), contacts)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			customers: this.customerApi.load(),
			contacts: this.contactApi.load(),
			warehouses: this.warehouseApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('customer.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly resultOpen = signal(false);

	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();
	readonly contactRows = signal<CustomerContactDto[]>([]);

	private _tempItemId = 0;

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('customer.lower'),
		}));

	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');

		this.form = { ...this._emptyForm() };
		this.contactRows.set([this._emptyContactRow()]);

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedCustomer();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			customerCode: row.customerCode,
			customerName: row.customerName,
			shortName: row.shortName,
			englishName: row.englishName ?? null,
			customerType: row.customerType,
			taxCode: row.taxCode ?? null,
			contactPerson: row.contactPerson ?? null,
			phone: row.phone ?? null,
			email: row.email ?? null,
			address: row.address ?? null,
			countryId: row.countryId ?? null,
			provinceId: row.provinceId ?? null,
			districtId: row.districtId ?? null,
			paymentTerm: row.paymentTerm ?? null,
			currencyId: row.currencyId ?? null,
			defaultWarehouseId: row.defaultWarehouseId ?? null,
			remark: row.remark ?? null,
			isActive: row.isActive ?? true,
		};

		this.contactRows.set(
			this.contactApi.items()
				.filter(d => d.customerId === row.id)
				.map(d => ({ ...d })));

		this.dialogOpen.set(true);
	}


	save(): void {
		const error = this._validate() || this._validateContact();
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
					entity: this.i18n.t('customer.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('customer.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedCustomer();
		if (!row) return;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('customer.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.customerName })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.customerApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.customerName })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('customer.lower') }), err),
			}),
		});
	}

	// ─── rule grid ────────────────────────────────────────────────────────────
	addContactRow(): void {
		this.contactRows.update(rows => [...rows, this._emptyContactRow()]);
	}

	removeContactRow(row: CustomerContactDto): void {
		this.contactRows.update(rows => rows.filter(r => r !== row));
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			customerCode: '',
			customerName: '',
			shortName: '',
			englishName: null as string | null,
			customerType: 1,
			taxCode: null as string | null,
			contactPerson: null as string | null,
			phone: null as string | null,
			email: null as string | null,
			address: null as string | null,
			countryId: null as number | null,
			provinceId: null as number | null,
			districtId: null as number | null,
			paymentTerm: null as string | null,
			currencyId: null as number | null,
			defaultWarehouseId: null as number | null,
			remark: null as string | null,
			isActive: true,
		};
	}

	private _emptyContactRow() {
		return {
			id: this._tempItemId--,
			customerId: null as number | null,
			contactName: '',
			contactType: 1,
			position: null as string | null,
			phone: '',
			email: null as string | null,
			isPrimary: false,
			isActive: true,
			remark: null as string | null,
		};
	}


	private _validate(): string {
		const customerCode = this.form.customerCode.trim();

		if (!customerCode) {
			return this.i18n.t('customer.err.customerCodeRequired');
		}

		if (!this.form.customerName) {
			return this.i18n.t('customer.err.customerNameRequired');
		}

		if (!this.form.shortName) {
			return this.i18n.t('customer.err.shortNameRequired');
		}
		if (!this.form.address) {
			return this.i18n.t('customer.err.addressRequired');
		}

		const clash = this.customers().find(
			customer =>
				customer.customerCode.toLowerCase() === customerCode.toLowerCase() &&
				customer.id !== this.editingId(),
		);

		return clash
			? this.i18n.t('customer.err.customerCodeTaken', { customerCode })
			: '';
	}

	private _validateContact(): string {
		const rows = this.contactRows();
		if (rows.length === 0) return this.i18n.t('customerContact.err.linesRequired');

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const line = i + 1;

			if (!row.contactName) return this.i18n.t('customerContact.err.contactNameRequired', { line });
			if (!row.phone) return this.i18n.t('customerContact.err.phoneRequired', { line });

		}

		return '';
	}

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _savePlan(id: number | null): Observable<CustomerDto> {
		const body: CustomerRequest = {
			customerCode: this.form.customerCode,
			customerName: this.form.customerName,
			shortName: this.form.shortName,
			englishName: this.form.englishName ?? null,
			customerType: this.form.customerType,
			taxCode: this.form.taxCode ?? null,
			contactPerson: this.form.contactPerson ?? null,
			phone: this.form.phone ?? null,
			email: this.form.email ?? null,
			address: this.form.address ?? null,
			countryId: this.form.countryId ?? null,
			provinceId: this.form.provinceId ?? null,
			districtId: this.form.districtId ?? null,
			paymentTerm: this.form.paymentTerm ?? null,
			currencyId: this.form.currencyId ?? null,
			defaultWarehouseId: this.form.defaultWarehouseId ?? null,
			remark: this.form.remark ?? null,
			isActive: this.form.isActive ?? true,
			customerContacts: this.contactRows().map((r) => ({
				id: r.id > 0 ? r.id : 0,
				customerId: r.customerId ?? null,
				contactName: r.contactName,
				contactType: r.contactType,
				position: r.position ?? null,
				phone: r.phone,
				email: r.email ?? null,
				isPrimary: r.isPrimary,
				isActive: r.isActive,
				remark: r.remark ?? null,
			}))
		};
		return id ? this.customerApi.update(id, body) : this.customerApi.create(body);
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
