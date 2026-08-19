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
    actionType?: number | null;
}

export const INVENTORY_TRANSACTION_TYPES = [
    {
        labelKey: 'inventoryTransaction.transactionType.receipt',
        value: 1,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.issue',
        value: 2,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.transfer',
        value: 3,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.adjust',
        value: 4,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.productionIn',
        value: 5,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.productionOut',
        value: 6,
    },
    {
        labelKey: 'inventoryTransaction.transactionType.scrap',
        value: 7,
    },
];

export const INVENTORY_REFERENCE_TYPES = [
    {
        labelKey: 'inventoryTransaction.referenceType.goodsReceipt',
        value: 1,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.goodsIssue',
        value: 2,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.transferIn',
        value: 3,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.transferOut',
        value: 4,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.materialIssue',
        value: 5,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.materialReturn',
        value: 6,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.productionReceipt',
        value: 7,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.productionConsume',
        value: 8,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.adjustment',
        value: 9,
    },
    {
        labelKey: 'inventoryTransaction.referenceType.scrap',
        value: 10,
    },
];

export const INVENTORY_ACTION_TYPES = [
    {
        labelKey: 'inventoryTransaction.actionType.add',
        value: 1,
    },
    {
        labelKey: 'inventoryTransaction.actionType.update',
        value: 2,
    },
    {
        labelKey: 'inventoryTransaction.actionType.remove',
        value: 3,
    }
];