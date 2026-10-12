/** Mirrors OrganizationDto (MasterData) and UserDto (Administration) on the backend. */

export interface OrganizationDto {
	id: number;
	organizationCode: string;
	organizationName: string;
	/** Organizations nest: a unit may sit under another unit. */
	parentId?: number | null;
}

export interface UserDto {
	id: number;
	code: string;
	loginName: string;
	fullName: string;
	email?: string | null;
	isAdmin: boolean;
	organizationId?: number | null;
}

export type OrganizationRequest = Omit<OrganizationDto, 'id'>;

/**
 * Create requires `password`; update treats it as optional and leaves the stored hash
 * alone when it is null — see CreateUserRequest / UpdateUserRequest on the backend.
 * The DTO never returns a password, so it only ever travels in this direction.
 */
export type UserRequest = Omit<UserDto, 'id'> & { password?: string | null };


//#region Company
export interface CompanyDto {
	id: number;
	companyCode: string;
	companyName: string;
	shortName: string;
	englishName: string;
	taxCode: string;

	businessRegistrationNo: string;
	businessRegistrationDate: string;
	businessRegistrationPlace: string;

	logoUrl?: string | null;
	website?: string | null;
	phone?: string | null;
	fax?: string | null;
	email?: string | null;
	representativeName?: string | null;
	representativePosition?: string | null;

	address: string;
	provinceId: number;
	districtId: number;
	wardId: number;

	contactName: string;
	contactPhone: string;
	contactEmail: string;

	currencyCode?: string | null;
	timeZone?: string | null;
	weightUnitId?: number | null;
	volumeUnitId?: number | null;
	defaultWarehouseId?: number | null;
	defaultFactoryId?: number | null;

	isActive: boolean;
	remark?: string | null;
}

export type CompanyRequest = Omit<CompanyDto, 'id'>;

export const COMPANY_PROVINCES = [
	{ labelKey: 'company.province.hanoi', value: 1 },
	{ labelKey: 'company.province.haiphong', value: 2 },
	{ labelKey: 'company.province.hungyen', value: 3 },
];

export const COMPANY_DISTRICTS = [
	{ labelKey: 'company.district.hanoi', value: 1 },
	{ labelKey: 'company.district.haiphong', value: 2 },
	{ labelKey: 'company.district.hungyen', value: 3 },
];

export const COMPANY_WARDS = [
	{ labelKey: 'company.ward.hanoi', value: 1 },
	{ labelKey: 'company.ward.haiphong', value: 2 },
	{ labelKey: 'company.ward.hungyen', value: 3 },
];

//#endregion


//#region Workshop
export interface WorkshopDto {
	id: number;
	companyId?: number | null;
	factoryId?: number | null;

	workshopCode: string;
	workshopName: string;
	shortName: string;
	englishName: string;

	managerId?: number | null;

	phone: string;
	email: string;
	location: string;
	description: string;

	isActive: boolean;
	sortOrder: number;
}
export type WorkshopRequest = Omit<WorkshopDto, 'id'>;
//#endregion

//#region Department
export interface DepartmentDto {
	id: number;
	companyId?: number | null;
	factoryId?: number | null;
	workshopId?: number | null;
	parentId?: number | null;

	departmentCode: string;
	departmentName: string;
	shortName?: string | null;
	englishName?: string | null;

	managerId?: number | null;

	phone?: string | null;
	email?: string | null;
	location?: string | null;
	description?: string | null;

	isActive: boolean;
	sortOrder: number;
}

export type DepartmentRequest = Omit<DepartmentDto, 'id'>;
//#endregion

//#region WorkCenter
export interface WorkCenterDto {
	id: number;
	factoryId?: number | null;
	workshopId?: number | null;
	workCenterCode: string;
	workCenterName: string;
	shortName?: string | null;
	englishName?: string | null;
	/** 1: Production; 2: Assembly; 3: Inspection; 4: Packaging; 5: Warehouse; 6: Maintenance; 99: Other */
	workCenterType?: number | null;
	managerId: number;
	location?: string | null;
	description?: string | null;
	/** 1: Active; 2: Inactive; 3: Maintenance */
	status: number;
	sortOrder: number;
}
export type WorkCenterRequest = Omit<WorkCenterDto, 'id'>;


export const WORK_CENTER_TYPES = [
	{ labelKey: 'workcenter.type.production', value: 1 },
	{ labelKey: 'workcenter.type.assembly', value: 2 },
	{ labelKey: 'workcenter.type.inspection', value: 3 },
	{ labelKey: 'workcenter.type.packaging', value: 4 },
	{ labelKey: 'workcenter.type.warehouse', value: 5 },
	{ labelKey: 'workcenter.type.maintenance', value: 6 },
	{ labelKey: 'workcenter.type.other', value: 99 },
];

export const WORK_CENTER_STATUSES = [
	{ labelKey: 'workcenter.status.active', value: 1, severity: 'success' as const },
	{ labelKey: 'workcenter.status.inactive', value: 2, severity: 'danger' as const },
	{ labelKey: 'workcenter.status.maintenance', value: 3, severity: 'warn' as const },
];

export function workCenterStatusOf(status?: number | null) {
	return WORK_CENTER_STATUSES.find(s => s.value === status);
}
//#endregion

//#region Production Team

export interface ProductionTeamDto {
	id: number;
	companyId?: number | null;
	factoryId?: number | null;
	workshopId?: number | null;
	departmentId: number;
	teamCode: string;
	teamName: string;
	shortName?: string | null;
	englishName?: string | null;
	teamLeaderId: number;
	deputyLeaderId?: number | null;
	phone?: string | null;
	email?: string | null;
	location?: string | null;
	description?: string | null;
	isActive: boolean;
	sortOrder: number;
}

export interface ProductionTeamEmployeeDto {
	id: number;
	productionTeamId?: number | null;
	employeeId?: number | null;
	isPrimary?: boolean | null;
	fromDate?: string | null;
	toDate?: string | null;
	remark?: string | null;
}

export type ProductionTeamRequest = Omit<ProductionTeamDto, 'id'> & {
	employees?: ProductionTeamEmployeeRequest[] | [];
};

export type ProductionTeamEmployeeRequest = Omit<ProductionTeamEmployeeDto, 'id'>;
//#endregion