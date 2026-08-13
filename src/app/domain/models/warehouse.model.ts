export interface WarehouseDto {
    id: number;
    factoryId?: number | null;
    warehouseCode?: string | null;
    warehouseName?: string | null;
    warehouseType?: number | null;
    isActive?: boolean | null;
    description?: string | null;
}

export interface WarehouseRequest {
    id: number;
    factoryId?: number | null;
    warehouseCode?: string | null;
    warehouseName?: string | null;
    warehouseType?: number | null;
    isActive?: boolean | null;
    description?: string | null;
}

export interface LocationDto {
    id: number;
    warehouseZoneId?: number | null;
    warehouseLocationCode?: string | null;
    warehouseLocationName?: string | null;
    maxCapacity?: number | null;
    isPickingLocation?: boolean | null;
    isActive?: boolean | null;
}

export interface LocationRequest {
    id: number;
    warehouseZoneId?: number | null;
    warehouseLocationCode?: string | null;
    warehouseLocationName?: string | null;
    maxCapacity?: number | null;
    isPickingLocation?: boolean | null;
    isActive?: boolean | null;
}