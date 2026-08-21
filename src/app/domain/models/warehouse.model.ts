/** Mirrors the backend DTOs in RFactory.Application.Modules.Warehouses.DTOs. */

export interface WarehouseDto {
  id: number;
  factoryId?: number | null;
  warehouseCode: string;
  warehouseName: string;
  warehouseType?: number | null;
  isActive?: boolean | null;
  description: string;
}

export interface WarehouseZoneDto {
  id: number;
  warehouseId?: number | null;
  warehouseZoneCode: string;
  warehouseZoneName: string;
  description: string;
}

export interface WarehouseLocationDto {
  id: number;
  warehouseZoneId?: number | null;
  warehouseLocationCode: string;
  warehouseLocationName: string;
  maxCapacity?: number | null;
  isPickingLocation?: boolean | null;
  isActive?: boolean | null;
  warehouseId?: number | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  warehouseZoneCode?: string | null;
  warehouseZoneName?: string | null;
}

/** Create/Update share one shape per entity on the backend, so one type covers both. */
export type WarehouseRequest = Omit<WarehouseDto, 'id'>;
export type WarehouseZoneRequest = Omit<WarehouseZoneDto, 'id'>;
export type WarehouseLocationRequest = Omit<WarehouseLocationDto, 'id'>;

/**
 * `Warehouse.WarehouseType` is a nullable int in the database with no enum backing it,
 * so these labels are an assumption. Change the pairs here if the real coding differs.
 */
export const WAREHOUSE_TYPES = [
  { labelKey: 'wh.type.raw', value: 0, severity: 'info' as const },
  { labelKey: 'wh.type.finished', value: 1, severity: 'success' as const },
  { labelKey: 'wh.type.wip', value: 2, severity: 'warn' as const },
];

export function warehouseTypeOf(type?: number | null) {
  return WAREHOUSE_TYPES.find(t => t.value === type);
}
