import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { MessageService, ConfirmationService } from 'primeng/api';
import { I18nService } from '../../core/services/i18n.service';
import { CompanyApiService, UserApiService } from '../../core/services/organization-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { COMPANY_DISTRICTS, COMPANY_PROVINCES, COMPANY_WARDS, CompanyDto, CompanyRequest } from '../../domain/models/organization.model';
import { FieldsetModule } from 'primeng/fieldset';
import { ImageModule } from 'primeng/image';
import { FileSelectEvent, FileUpload, FileUploadEvent, FileUploadModule, } from 'primeng/fileupload';

type EntityKind = 'company';

@Component({
	selector: 'app-company',
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
		CheckboxModule,
		TabsModule,
		HasPermissionDirective,
		SplitterModule,
		Textarea,
		InputGroupModule,
		InputGroupAddonModule,
		ColorPickerModule,
		PanelModule,
		FieldsetModule,
		ImageModule,
		FileUpload
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './company.component.html',
	styleUrl: './company.component.scss',
})
export class CompanyComponent extends PermissionAwarePage implements OnInit {
	private readonly companyApi = inject(CompanyApiService);
	private readonly userApi = inject(UserApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	userLabel(id?: number | null): string {
		if (id == null) return '';
		const user = this.userApi.items().find(u => u.id === id);
		return user ? `${user.code} · ${user.fullName}` : '';
	}

	provinceLabel(id?: number | null): string {
		if (id == null) return '';
		const province = COMPANY_PROVINCES.find(u => u.value === id);
		return province ? this.i18n.t(province.labelKey) : '';
	}

	districtLabel(id?: number | null): string {
		if (id == null) return '';
		const district = COMPANY_DISTRICTS.find(u => u.value === id);
		return district ? this.i18n.t(district.labelKey) : '';
	}

	wardLabel(id?: number | null): string {
		if (id == null) return '';
		const ward = COMPANY_WARDS.find(u => u.value === id);
		return ward ? this.i18n.t(ward.labelKey) : '';
	}

	readonly userOptions = computed(() =>
		this.userApi.items().map(u => ({ label: `${u.code} · ${u.fullName}`, value: u.id })));

	readonly provinceOptions = computed(() =>
		COMPANY_PROVINCES.map(p => ({ label: this.i18n.t(p.labelKey), value: p.value })));

	readonly districtOptions = computed(() =>
		COMPANY_DISTRICTS.map(d => ({ label: this.i18n.t(d.labelKey), value: d.value })));

	readonly wardOptions = computed(() =>
		COMPANY_WARDS.map(w => ({ label: this.i18n.t(w.labelKey), value: w.value })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCompany = signal<CompanyDto | null>(null);

	readonly companies = computed(() => {
		const all = this.companyApi.items();
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly companyTable = viewChild<Table>('companyTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		company: [''],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			company: this.companyTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'company') {
			this.selectedCompany.set(this._reconcile(this.selectedCompany(), visible as CompanyDto[]));
		}
	}

	selectCompany(company: CompanyDto): void {
		if (this.selectedCompany()?.id === company.id) return;
		this.selectedCompany.set(company);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.company);

		effect(() => {
			const companies = this.companies();
			untracked(() => this.selectedCompany.set(this._reconcile(this.selectedCompany(), companies)));
		});


	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			companies: this.companyApi.load(),
			users: this.userApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('company.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');
	form = this._emptyForm();

	uploadedFiles: any[] = [];

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t('company.lower'),
		}));


	openCreate(): void {
		this.editingId.set(null);
		this.formError.set('');
		this.form = { ...this._emptyForm() };

		this.dialogOpen.set(true);
	}

	openEdit(): void {
		const row = this.selectedCompany();
		if (!row) return;
		this.editingId.set(row.id);
		this.formError.set('');

		this.form = {
			companyCode: row.companyCode.trim(),
			companyName: row.companyName.trim(),
			shortName: row.shortName.trim(),
			englishName: row.englishName.trim(),
			taxCode: row.taxCode.trim(),

			businessRegistrationNo: row.businessRegistrationNo.trim(),
			businessRegistrationDate: row.businessRegistrationDate.trim(),
			businessRegistrationPlace: row.businessRegistrationPlace.trim(),

			logoUrl: row.logoUrl?.trim() ?? null,
			website: row.website?.trim() ?? null,
			phone: row.phone?.trim() ?? null,
			fax: row.fax?.trim() ?? null,
			email: row.email?.trim() ?? null,
			representativeName: row.representativeName?.trim() ?? null,
			representativePosition: row.representativePosition?.trim() ?? null,

			address: row.address.trim(),
			provinceId: row.provinceId,
			districtId: row.districtId,
			wardId: row.wardId,

			contactName: row.contactName?.trim(),
			contactPhone: row.contactPhone?.trim(),
			contactEmail: row.contactEmail?.trim(),

			currencyCode: row.currencyCode?.trim() ?? null,
			timeZone: row.timeZone?.trim() ?? null,
			weightUnitId: row.weightUnitId ?? null,
			volumeUnitId: row.volumeUnitId ?? null,
			defaultWarehouseId: row.defaultWarehouseId ?? null,
			defaultFactoryId: row.defaultFactoryId ?? null,

			isActive: row.isActive,
			remark: row.remark?.trim() ?? null,
		};

		// row.logoUrl = 'https://khodohoa.vn/wp-content/uploads/2019/09/43087481675_3969d2e92c_o.jpg';
		this.loadImage(row.logoUrl ?? null, 'icon-512.png');

		this.dialogOpen.set(true);
	}


	save(): void {
		// const error = this._validate();
		// if (error) {
		// 	this.formError.set(error);
		// 	return;
		// }

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		// One call carrying the header and every line: the backend writes them in a single
		// transaction, so a rejected line cannot leave a receipt behind.
		this._saveCompany(id).subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t('company.lower'),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('company.lower') }));
			},
		});
	}

	askDelete(): void {
		const row = this.selectedCompany();
		if (!row) return;

		// this.confirm.confirm({
		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('company.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label: row.companyCode })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => this.companyApi.remove(row.id).subscribe({
				next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.companyCode })); },
				error: (err: HttpErrorResponse) =>
					this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('company.lower') }), err),
			}),
		});
	}

	onUpload(event: FileUploadEvent) {
		console.log(event.files);

		// for (let file of event.files) {
		// 	this.uploadedFiles.push(file);
		// }


		// this.messages.add({ severity: 'info', summary: 'File Uploaded', detail: '' });
	}

	onSelect(event: FileSelectEvent) {
		console.log(event);
		console.log(event.files);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm() {
		return {
			companyCode: '',
			companyName: '',
			shortName: '',
			englishName: '',
			taxCode: '',

			businessRegistrationNo: '',
			businessRegistrationDate: '',
			businessRegistrationPlace: '',

			logoUrl: null as string | null,
			website: null as string | null,
			phone: null as string | null,
			fax: null as string | null,
			email: null as string | null,
			representativeName: null as string | null,
			representativePosition: null as string | null,

			address: '',
			provinceId: 0,
			districtId: 0,
			wardId: 0,

			contactName: '',
			contactPhone: '',
			contactEmail: '',

			currencyCode: null as string | null,
			timeZone: null as string | null,
			weightUnitId: null as number | null,
			volumeUnitId: null as number | null,
			defaultWarehouseId: null as number | null,
			defaultFactoryId: null as number | null,

			isActive: true,
			remark: null as string | null,
		};
	}


	// private _validate(): string {
	// 	const groupNo = this.form.groupNo.trim();

	// 	if (!groupNo) {
	// 		return this.i18n.t('productGroup.err.groupNoRequired');
	// 	}

	// 	if (!this.form.groupName) {
	// 		return this.i18n.t('productGroup.err.groupNameRequired');
	// 	}

	// 	// IssueNo is unique across the entire goods issue list.
	// 	const clash = this.groups().find(
	// 		group =>
	// 			group.groupNo.toLowerCase() === groupNo.toLowerCase() &&
	// 			group.id !== this.editingId(),
	// 	);

	// 	return clash
	// 		? this.i18n.t('productGroup.err.groupNoTaken', { groupNo })
	// 		: '';
	// }

	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _saveCompany(id: number | null): Observable<CompanyDto> {
		const body: CompanyRequest = {
			companyCode: this.form.companyCode.trim(),
			companyName: this.form.companyName.trim(),
			shortName: this.form.shortName.trim(),
			englishName: this.form.englishName.trim(),
			taxCode: this.form.taxCode.trim(),

			businessRegistrationNo: this.form.businessRegistrationNo.trim(),
			businessRegistrationDate: this.form.businessRegistrationDate.trim(),
			businessRegistrationPlace: this.form.businessRegistrationPlace.trim(),

			logoUrl: this.form.logoUrl?.trim() ?? null,
			website: this.form.website?.trim() ?? null,
			phone: this.form.phone?.trim() ?? null,
			fax: this.form.fax?.trim() ?? null,
			email: this.form.email?.trim() ?? null,
			representativeName: this.form.representativeName?.trim() ?? null,
			representativePosition: this.form.representativePosition?.trim() ?? null,

			address: this.form.address?.trim(),
			provinceId: this.form.provinceId,
			districtId: this.form.districtId,
			wardId: this.form.wardId,

			contactName: this.form.contactName?.trim(),
			contactPhone: this.form.contactPhone?.trim(),
			contactEmail: this.form.contactEmail?.trim(),

			currencyCode: this.form.currencyCode?.trim() ?? null,
			timeZone: this.form.timeZone?.trim() ?? null,
			weightUnitId: this.form.weightUnitId ?? null,
			volumeUnitId: this.form.volumeUnitId ?? null,
			defaultWarehouseId: this.form.defaultWarehouseId ?? null,
			defaultFactoryId: this.form.defaultFactoryId ?? null,

			isActive: this.form.isActive,
			remark: this.form.remark?.trim() ?? null,
		};
		return id ? this.companyApi.update(id, body) : this.companyApi.create(body);
	}

	async loadImage(url: string | null, imageName: string | null) {
		if (!url) return;

		const response = await fetch(url);
		const blob = await response.blob();

		this.uploadedFiles = [
			new File([blob], imageName ?? '', {
				type: blob.type
			})
		];
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
