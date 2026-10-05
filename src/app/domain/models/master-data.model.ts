/** Mirrors the backend DTOs in RFactory.Application.Modules.MasterData.DTOs. */

export interface FactoryDto {
	id: number;
	factoryCode: string;
	factoryName: string;
}

export interface AreaDto {
	id: number;
	factoryId?: number | null;
	areaCode: string;
	areaName: string;
}

export interface LineDto {
	id: number;
	areaId?: number | null;
	lineCode: string;
	lineName: string;
	status?: number | null;
	layoutImage?: string | null;
}

export interface SupplierDto {
	id: number;
	supplierCode: string;
	supplierName: string;
	shortName?: string | null;
	taxCode?: string | null;
	supplierType?: string | null;
	phone?: string | null;
	email?: string | null;
	website?: string | null;
	contactPerson?: string | null;
	paymentTerm?: string | null;
	currencyCode?: string | null;
	status: number;
	description?: string | null;
}

export interface CustomerDto {
	id: number;
	customerCode: string;
	customerName: string;
	shortName: string;
	englishName?: string | null;
	customerType: number;
	taxCode?: string | null;
	contactPerson?: string | null;
	phone?: string | null;
	email?: string | null;
	address?: string | null;
	countryId?: number | null;
	provinceId?: number | null;
	districtId?: number | null;
	paymentTerm?: string | null;
	currencyId?: number | null;
	defaultWarehouseId?: number | null;
	remark?: string | null;
	isActive?: boolean | null;
}

export interface CustomerContactDto {
	id: number;
	customerId?: number | null;
	contactName: string;
	contactType: number;
	position?: string | null;
	phone: string;
	email?: string | null;
	isPrimary: boolean;
	isActive?: boolean | null;
	remark?: string | null;
}


/** Create/Update share one shape per entity on the backend, so one type covers both. */
export type FactoryRequest = Omit<FactoryDto, 'id'>;
export type AreaRequest = Omit<AreaDto, 'id'>;
export type LineRequest = Omit<LineDto, 'id'>;
export type SupplierRequest = Omit<SupplierDto, 'id'>;

export type CustomerRequest = Omit<CustomerDto, 'id'> & {
	customerContacts?: CustomerContactDto[];
};
export type CustomerContactRequest = Omit<CustomerContactDto, 'id'>;

/**
 * `Line.Status` is a nullable int in the database with no enum or lookup table backing
 * it, so these labels are an assumption. Change the pairs here if the real coding
 * differs — nothing else reads the raw numbers.
 */
export const LINE_STATUSES = [
	{ labelKey: 'plant.status.running', value: 1, severity: 'success' as const },
	{ labelKey: 'plant.status.stopped', value: 0, severity: 'danger' as const },
];

export const SUPPLIER_STATUS = [
	{
		labelKey: 'supplier.status.inactive',
		value: 0,
		severity: 'danger' as const
	},
	{
		labelKey: 'supplier.status.active',
		value: 1,
		severity: 'success' as const
	},
	{
		labelKey: 'supplier.status.pending',
		value: 2,
		severity: 'warn' as const
	},

];

export const CUSTOMER_TYPES = [
	{ labelKey: 'customer.type.domestic', value: 1 },
	{ labelKey: 'customer.type.international', value: 2 },
	{ labelKey: 'customer.type.internal', value: 3 },
	{ labelKey: 'customer.type.other', value: 99 },
];

export const CUSTOMER_CONTACT_TYPES = [
	{ labelKey: 'customerContact.type.purchasing', value: 1 },
	{ labelKey: 'customerContact.type.technical', value: 2 },
	{ labelKey: 'customerContact.type.quality', value: 3 },
	{ labelKey: 'customerContact.type.receiver', value: 4 },
	{ labelKey: 'customerContact.type.accountant', value: 5 },
	{ labelKey: 'customerContact.type.other', value: 99 },
];

export const CUSTOMER_COUNTRIES = [
	{ labelKey: 'customer.country.vietnam', value: 1 },
	{ labelKey: 'customer.country.other', value: 99 },
];

export const CUSTOMER_PROVINCES = [
	{ labelKey: 'customer.province.hanoi', value: 1 },
	{ labelKey: 'customer.province.haiphong', value: 2 },
	{ labelKey: 'customer.province.hungyen', value: 3 },
];

export const CUSTOMER_DISTRICTS = [
	{ labelKey: 'customer.district.hanoi', value: 1 },
	{ labelKey: 'customer.district.haiphong', value: 2 },
	{ labelKey: 'customer.district.hungyen', value: 3 },
];

export const CUSTOMER_CURRENCIES = [
	{ labelKey: 'customer.currency.vnd', value: 1 },
	{ labelKey: 'customer.currency.usd', value: 2 },
	{ labelKey: 'customer.currency.eur', value: 3 },
	{ labelKey: 'customer.currency.gbp', value: 4 },
	{ labelKey: 'customer.currency.jpy', value: 5 },
	{ labelKey: 'customer.currency.krw', value: 6 },
	{ labelKey: 'customer.currency.cny', value: 7 },
	{ labelKey: 'customer.currency.other', value: 99 },
];

export function supplierStatusOf(status?: number | null) {
	return SUPPLIER_STATUS.find(s => s.value === status);
}

export function lineStatusOf(status?: number | null) {
	return LINE_STATUSES.find(s => s.value === status);
}
