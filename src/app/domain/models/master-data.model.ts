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

/** Create/Update share one shape per entity on the backend, so one type covers both. */
export type FactoryRequest = Omit<FactoryDto, 'id'>;
export type AreaRequest = Omit<AreaDto, 'id'>;
export type LineRequest = Omit<LineDto, 'id'>;
export type SupplierRequest = Omit<SupplierDto, 'id'>;

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

export function supplierStatusOf(status?: number | null) {
  return SUPPLIER_STATUS.find(s => s.value === status);
}

export function lineStatusOf(status?: number | null) {
  return LINE_STATUSES.find(s => s.value === status);
}
