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
import { ToastModule } from 'primeng/toast';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { I18nService } from '../../core/services/i18n.service';
import { CountryApiService, ProvinceApiService, DistrictApiService, WardApiService } from '../../core/services/master-data-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { CountryDto, CountryRequest, DISTRICT_TYPES, DistrictDto, DistrictRequest, PROVINCE_TYPES, ProvinceDto, ProvinceRequest, WARD_TYPES, WardDto, WardRequest } from '../../domain/models/master-data.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';


type EntityKind = 'country' | 'province' | 'district' | 'ward';

interface EntityForm {
	countryCode: string;
	countryName: string;
	englishName?: string | null;
	phoneCode?: string | null;
	isActive?: boolean | null;

	countryId?: number | null;
	provinceCode: string;
	provinceName: string;
	// englishName?: string | null;
	provinceType: number;
	postalCode?: string | null;
	// isActive?: boolean | null;

	provinceId?: number | null;
	districtCode: string;
	districtName: string;
	// englishName?: string | null;
	districtType: number;
	// isActive?: boolean | null;

	districtId?: number | null;
	wardCode: string;
	wardName: string;
	// englishName?: string | null;
	wardType: number;
	// isActive?: boolean | null;
}

const LABEL_KEYS: Record<EntityKind, string> = {
	country: 'country.lower',
	province: 'province.lower',
	district: 'district.lower',
	ward: 'ward.lower',
};

@Component({
	selector: 'app-country',
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
		ToggleButtonModule,
	],
	providers: [MessageService, ConfirmationService],
	standalone: true,
	templateUrl: './country.component.html',
	styleUrl: './country.component.scss',
})
export class CountryComponent extends PermissionAwarePage implements OnInit {
	private readonly countryApi = inject(CountryApiService);
	private readonly provinceApi = inject(ProvinceApiService);
	private readonly districtApi = inject(DistrictApiService);
	private readonly wardApi = inject(WardApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);
	readonly loading = computed(() => false);

	// ─── Lookups ────────────────────────────────────────────────────────────────
	provinceTypeLabel(id?: number | null): string {
		if (id == null) return '';
		const severity = PROVINCE_TYPES.find(u => u.value === id);
		return severity ? this.i18n.t(severity.labelKey) : '';
	}
	districtTypeLabel(id?: number | null): string {
		if (id == null) return '';
		const severity = DISTRICT_TYPES.find(u => u.value === id);
		return severity ? this.i18n.t(severity.labelKey) : '';
	}
	wardTypeLabel(id?: number | null): string {
		if (id == null) return '';
		const severity = WARD_TYPES.find(u => u.value === id);
		return severity ? this.i18n.t(severity.labelKey) : '';
	}

	countryLabel(id?: number | null): string {
		if (id == null) return '';
		const country = this.countryApi.items().find(u => u.id === id);
		return country ? `${country.countryCode} · ${country.countryName}` : '';
	}

	provinceLabel(id?: number | null): string {
		if (id == null) return '';
		const province = this.provinceApi.items().find(u => u.id === id);
		return province ? `${province.provinceCode} · ${province.provinceName}` : '';
	}

	districtLabel(id?: number | null): string {
		if (id == null) return '';
		const district = this.districtApi.items().find(u => u.id === id);
		return district ? `${district.districtCode} · ${district.districtName}` : '';
	}


	readonly provinceTypeOptions = computed(() =>
		PROVINCE_TYPES.map(u => ({ label: this.i18n.t(u.labelKey), value: u.value })));

	readonly districtTypeOptions = computed(() =>
		DISTRICT_TYPES.map(u => ({ label: this.i18n.t(u.labelKey), value: u.value })));

	readonly wardTypeOptions = computed(() =>
		WARD_TYPES.map(u => ({ label: this.i18n.t(u.labelKey), value: u.value })));

	readonly countryOptions = computed(() =>
		this.countryApi.items().map(u => ({ label: `${u.countryCode} · ${u.countryName}`, value: u.id })));

	readonly provinceOptions = computed(() =>
		this.provinceApi.items().map(u => ({ label: `${u.provinceCode} · ${u.provinceName}`, value: u.id })));

	readonly districtOptions = computed(() =>
		this.districtApi.items().map(u => ({ label: `${u.districtCode} · ${u.districtName}`, value: u.id })));

	// ─── Selection ──────────────────────────────────────────────────────────────
	readonly selectedCountry = signal<CountryDto | null>(null);
	readonly selectedProvince = signal<ProvinceDto | null>(null);
	readonly selectedDistrict = signal<DistrictDto | null>(null);
	readonly selectedWard = signal<WardDto | null>(null);

	readonly countries = computed(() => {
		const all = this.countryApi.items();
		return all;
	});

	readonly provinces = computed(() => {
		const id = this.selectedCountry()?.id;
		if (id == null) return [];
		const all = this.provinceApi.items().filter(d => d.countryId === id);
		return all;
	});

	readonly districts = computed(() => {
		const id = this.selectedProvince()?.id;
		if (id == null) return [];
		const all = this.districtApi.items().filter(d => d.provinceId === id);
		return all;
	});

	readonly wards = computed(() => {
		const id = this.selectedDistrict()?.id;
		if (id == null) return [];
		const all = this.wardApi.items().filter(d => d.districtId === id);
		return all;
	});

	// ─── Global filter ──────────────────────────────────────────────────────────
	private readonly countryTable = viewChild<Table>('countryTable');
	private readonly provinceTable = viewChild<Table>('provinceTable');
	private readonly districtTable = viewChild<Table>('districtTable');
	private readonly wardTable = viewChild<Table>('wardTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		country: ['countryCode', 'countryName', 'englishName', 'phoneCode'],
		province: ['provinceCode', 'provinceName', 'englishName', 'postalCode'],
		district: ['districtCode', 'districtName', 'englishName'],
		ward: ['wardCode', 'wardName', 'englishName'],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = {
			country: this.countryTable(),
			province: this.provinceTable(),
			district: this.districtTable(),
			ward: this.wardTable(),
		}[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'country') {
			this.selectedCountry.set(this._reconcile(this.selectedCountry(), visible as CountryDto[]));
		} else if (kind === 'province') {
			this.selectedProvince.set(this._reconcile(this.selectedProvince(), visible as ProvinceDto[]));
		} else if (kind === 'district') {
			this.selectedDistrict.set(this._reconcile(this.selectedDistrict(), visible as DistrictDto[]));
		} else if (kind === 'ward') {
			this.selectedWard.set(this._reconcile(this.selectedWard(), visible as WardDto[]));
		}
	}

	selectCountry(country: CountryDto): void {
		if (this.selectedCountry()?.id === country.id) return;
		this.selectedCountry.set(country);
	}

	selectProvince(province: ProvinceDto): void {
		if (this.selectedProvince()?.id === province.id) return;
		this.selectedProvince.set(province);
	}

	selectDistrict(district: DistrictDto): void {
		if (this.selectedDistrict()?.id === district.id) return;
		this.selectedDistrict.set(district);
	}

	selectWard(ward: WardDto): void {
		if (this.selectedWard()?.id === ward.id) return;
		this.selectedWard.set(ward);
	}

	constructor() {
		// The combinations below each drive one list inside the detail modal, so the selected
		// row has to stay valid when the underlying set changes (filter, reload, delete).
		super(PERMISSIONS.country);

		effect(() => {
			const countries = this.countries();
			untracked(() => this.selectedCountry.set(this._reconcile(this.selectedCountry(), countries)));
		});

		effect(() => {
			const provinces = this.provinces();
			untracked(() => this.selectedProvince.set(this._reconcile(this.selectedProvince(), provinces)));
		});

		effect(() => {
			const districts = this.districts();
			untracked(() => this.selectedDistrict.set(this._reconcile(this.selectedDistrict(), districts)));
		});

		effect(() => {
			const wards = this.wards();
			untracked(() => this.selectedWard.set(this._reconcile(this.selectedWard(), wards)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		forkJoin({
			countries: this.countryApi.load(),
			provinces: this.provinceApi.load(),
			districts: this.districtApi.load(),
			wards: this.wardApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('country.err.load'), err),
		});
	}

	// ─── Dialog ─────────────────────────────────────────────────────────────────
	readonly dialogOpen = signal(false);
	readonly dialogKind = signal<EntityKind>('country');
	readonly editingId = signal<number | null>(null);
	readonly saving = signal(false);
	readonly formError = signal('');

	form = this._emptyForm();

	readonly dialogTitle = computed(() =>
		this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
			entity: this.i18n.t(LABEL_KEYS[this.dialogKind()]),
		}));


	openCreate(kind: EntityKind): void {
		this.dialogKind.set(kind);
		this.editingId.set(null);
		this.formError.set('');
		this.form = {
			...this._emptyForm(),
			countryId: this.selectedCountry()?.id ?? null,
			provinceId: this.selectedProvince()?.id ?? null,
			districtId: this.selectedDistrict()?.id ?? null,
		};

		this.dialogOpen.set(true);
	}

	openEdit(kind: EntityKind): void {
		const row = {
			country: this.selectedCountry(),
			province: this.selectedProvince(),
			district: this.selectedDistrict(),
			ward: this.selectedWard(),
		}[kind];
		if (!row) return;

		this.dialogKind.set(kind);
		this.editingId.set(row.id);
		this.formError.set('');

		if (kind === 'country') {
			const d = row as CountryDto;
			this.form = {
				...this._emptyForm(),
				countryCode: d.countryCode,
				countryName: d.countryName,
				englishName: d.englishName ?? null,
				phoneCode: d.phoneCode ?? null,
				isActive: d.isActive ?? true,
			};
		} else if (kind === 'province') {
			const d = row as ProvinceDto;
			this.form = {
				...this._emptyForm(),
				countryId: d.countryId ?? null,
				provinceCode: d.provinceCode,
				provinceName: d.provinceName,
				englishName: d.englishName ?? null,
				provinceType: d.provinceType,
				postalCode: d.postalCode ?? null,
				isActive: d.isActive ?? true,
			};
		} else if (kind === 'district') {
			const d = row as DistrictDto;
			this.form = {
				...this._emptyForm(),
				provinceId: d.provinceId ?? null,
				districtCode: d.districtCode,
				districtName: d.districtName,
				englishName: d.englishName ?? null,
				districtType: d.districtType,
				isActive: d.isActive ?? true,
			};
		} else if (kind === 'ward') {
			const d = row as WardDto;
			this.form = {
				...this._emptyForm(),
				districtId: d.districtId ?? null,
				wardCode: d.wardCode,
				wardName: d.wardName,
				englishName: d.englishName ?? null,
				wardType: d.wardType,
				isActive: d.isActive ?? true,
			};
		}


		this.dialogOpen.set(true);
	}


	save(): void {
		const kind = this.dialogKind();
		const error = this._validate(kind);
		if (error) {
			this.formError.set(error);
			return;
		}

		this.saving.set(true);
		this.formError.set('');

		const id = this.editingId();

		const request = this._buildRequest(kind, id);
		if (!request) {
			this.saving.set(false);
			return;
		}

		request.subscribe({
			next: () => {
				this.saving.set(false);
				this.dialogOpen.set(false);
				this.reload();
				this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
					entity: this.i18n.t(LABEL_KEYS[kind]),
				}));
			},
			error: (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.formError.set(err.error?.message
					|| this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t(LABEL_KEYS[kind]) }));
			},
		});
	}

	askDelete(kind: EntityKind): void {
		const row = kind === 'country'
			? this.selectedCountry()
			: kind === 'province'
				? this.selectedProvince()
				: kind === 'district'
					? this.selectedDistrict()
					: this.selectedWard();

		if (!row) return;

		const label = kind === 'country'
			? (row as CountryDto).countryCode
			: kind === 'province'
				? (row as ProvinceDto).provinceCode
				: kind === 'district'
					? (row as DistrictDto).districtCode
					: (row as WardDto).wardCode;

		this.confirm.confirm({
			header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t(kind === 'country' ? 'country.lower' : kind === 'province' ? 'province.lower' : kind === 'district' ? 'district.lower' : 'ward.lower') }),
			message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
			acceptLabel: this.i18n.t('common.delete'),
			rejectLabel: this.i18n.t('common.cancel'),
			acceptButtonStyleClass: 'p-button-danger',
			rejectButtonStyleClass: 'p-button-text',
			// The backend owns the "still used by products" rule and returns its own message.
			accept: () => {
				if (kind === 'country') {
					this.countryApi.remove(row.id).subscribe({
						next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
						error: (err: HttpErrorResponse) =>
							this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('country.lower') }), err),
					});
				}
				else if (kind === 'province') {
					this.provinceApi.remove(row.id).subscribe({
						next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
						error: (err: HttpErrorResponse) =>
							this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('province.lower') }), err),
					});
				}
				else if (kind === 'district') {
					this.districtApi.remove(row.id).subscribe({
						next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
						error: (err: HttpErrorResponse) =>
							this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('district.lower') }), err),
					});
				}
				else if (kind === 'ward') {
					this.wardApi.remove(row.id).subscribe({
						next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: label })); },
						error: (err: HttpErrorResponse) =>
							this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('ward.lower') }), err),
					});
				}
			},
		});
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
	private _emptyForm(): EntityForm {
		return {
			countryCode: '',
			countryName: '',
			englishName: null as string | null,
			phoneCode: null as string | null,
			isActive: true as boolean | null,

			countryId: null as number | null,
			provinceCode: '',
			provinceName: '',
			provinceType: 1,
			postalCode: null as string | null,

			provinceId: null as number | null,
			districtCode: '',
			districtName: '',
			districtType: 1,

			districtId: null as number | null,
			wardCode: '',
			wardName: '',
			wardType: 1,
		};
	}

	private _validate(kind: EntityKind): string {
		if (kind == 'country') {
			const countryCode = this.form.countryCode?.trim();

			if (!countryCode) {
				return this.i18n.t('country.err.countryCodeRequired');
			}

			if (!this.form.countryName) {
				return this.i18n.t('country.err.countryNameRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.countries().find(
				country =>
					country.countryCode?.toLowerCase() === countryCode.toLowerCase() &&
					country.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('country.err.countryCodeTaken', { countryCode })
				: '';
		}
		else if (kind == 'province') {
			const provinceCode = this.form.provinceCode?.trim();

			if (!provinceCode) {
				return this.i18n.t('province.err.provinceCodeRequired');
			}

			if (!this.form.provinceName) {
				return this.i18n.t('province.err.provinceNameRequired');
			}

			if (!this.form.provinceType || this.form.provinceType <= 0) {
				return this.i18n.t('province.err.provinceTypeRequired');
			}

			if (!this.form.countryId || this.form.countryId <= 0) {
				return this.i18n.t('province.err.countryIdRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.provinces().find(
				province =>
					province.provinceCode?.toLowerCase() === provinceCode.toLowerCase() &&
					province.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('province.err.provinceCodeTaken', { provinceCode })
				: '';
		}
		else if (kind == 'district') {
			const districtCode = this.form.districtCode?.trim();

			if (!districtCode) {
				return this.i18n.t('district.err.districtCodeRequired');
			}

			if (!this.form.districtName) {
				return this.i18n.t('district.err.districtNameRequired');
			}

			if (!this.form.districtType || this.form.districtType <= 0) {
				return this.i18n.t('district.err.districtTypeRequired');
			}

			if (!this.form.provinceId || this.form.provinceId <= 0) {
				return this.i18n.t('district.err.provinceIdRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.districts().find(
				district =>
					district.districtCode?.toLowerCase() === districtCode.toLowerCase() &&
					district.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('district.err.districtCodeTaken', { districtCode })
				: '';
		}
		else if (kind == 'ward') {
			const wardCode = this.form.wardCode?.trim();

			if (!wardCode) {
				return this.i18n.t('ward.err.wardCodeRequired');
			}

			if (!this.form.wardName) {
				return this.i18n.t('ward.err.wardNameRequired');
			}

			if (!this.form.wardType || this.form.wardType <= 0) {
				return this.i18n.t('ward.err.wardTypeRequired');
			}

			if (!this.form.districtId || this.form.districtId <= 0) {
				return this.i18n.t('ward.err.districtIdRequired');
			}

			// IssueNo is unique across the entire goods issue list.
			const clash = this.wards().find(
				ward =>
					ward.wardCode?.toLowerCase() === wardCode.toLowerCase() &&
					ward.id !== this.editingId(),
			);

			return clash
				? this.i18n.t('ward.err.wardCodeTaken', { wardCode })
				: '';
		}
		return '';

	}



	/** Reports the first bad line by its position — the operator reads the grid by row, not by id. */

	private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
		if (kind == 'country') {
			const body: CountryRequest = {
				countryCode: this.form.countryCode,
				countryName: this.form.countryName,
				englishName: this.form.englishName,
				phoneCode: this.form.phoneCode ?? null,
				isActive: this.form.isActive ?? true,
			};
			return id ? this.countryApi.update(id, body) : this.countryApi.create(body);
		}
		else if (kind == 'province') {
			const body: ProvinceRequest = {
				countryId: this.form.countryId ?? null,
				provinceCode: this.form.provinceCode,
				provinceName: this.form.provinceName,
				englishName: this.form.englishName ?? null,
				provinceType: this.form.provinceType,
				postalCode: this.form.postalCode ?? null,
				isActive: this.form.isActive ?? true,
			};
			return id ? this.provinceApi.update(id, body) : this.provinceApi.create(body);
		}
		else if (kind == 'district') {
			const body: DistrictRequest = {
				provinceId: this.form.provinceId ?? null,
				districtCode: this.form.districtCode,
				districtName: this.form.districtName,
				englishName: this.form.englishName ?? null,
				districtType: this.form.districtType,
				isActive: this.form.isActive ?? true,
			};
			return id ? this.districtApi.update(id, body) : this.districtApi.create(body);
		}
		else if (kind == 'ward') {
			const body: WardRequest = {
				districtId: this.form.districtId ?? null,
				wardCode: this.form.wardCode,
				wardName: this.form.wardName,
				englishName: this.form.englishName ?? null,
				wardType: this.form.wardType,
				isActive: this.form.isActive ?? true,
			};
			return id ? this.wardApi.update(id, body) : this.wardApi.create(body);
		}

		return null;
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
