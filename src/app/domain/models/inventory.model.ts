export interface InventoryDto {
    id: number;
    productId?: number | null;
    warehouseId?: number | null;
    locationId?: number | null;
    lotNo?: string | null;
    serialNo?: string | null;
    quantity?: number | null;
    reservedQuantity?: number | null;
    availableQuantity?: number | null;
    unitId?: number | null;
    lastTransactionDate?: string | null;
}

export interface InventoryTransactionDto {
    id: number;
    transactionNo?: string | null;
    transactionType?: number | null;
    productId?: number | null;
    warehouseId?: number | null;
    warehouseLocationId?: number | null;
    quantity?: number | null;
    unitId?: number | null;
    referenceType: number;
    referenceId?: number | null;
    transactionDate?: string | null;
}