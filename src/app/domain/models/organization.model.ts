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
